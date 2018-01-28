
const AWS = require('aws-sdk');
const request = require('request');

const asMetricData = (output) => {
  const dimensions = [{
    Name: 'endpoint',
    Value: output.endpoint,
  },
  {
    Name: 'method',
    Value: output.method,
  }
  ];
  return {
    Namespace: 'status-checker/HTTP',
    MetricData: [
      {
        MetricName: 'status_code',
        Dimensions: dimensions,
        StatisticValues: {
          SampleCount: 1,
          Sum: output.status_code,
          Minimum: 0,
          Maximum: 1000,
        },
        Unit: 'None',
      },
      {
        MetricName: 'latency',
        Dimensions: dimensions,
        StatisticValues: {
          SampleCount: 1,
          Sum: output.duration_ms,
          Minimum: 0,
          Maximum: 30000,
        },
        Unit: 'Milliseconds',
      },
    ],
  };
};

const checkEndpoint = (endpoint, callback) => {
  const options = JSON.parse(JSON.stringify(endpoint));

  if (!('headers' in options)) {
    options.headers = {};
  }
  options.headers['User-Agent'] = 'status-checker';
  options.time = true;
  options.method = options.method || 'GET'

  request(options, (error, response) => {
    const output = {
      endpoint: endpoint.url,
      method: options.method,
    };

    if (error) {
      output.error_code = error.code;
      output.status_code = 0;
      output.duration_ms = 0;
    } else {
      output.status_code = response.statusCode;
      output.duration_ms = response.timingPhases.total;
    }

    console.log(`checked ${options.method} ${options.url}`);
    callback(output);
  });
};

let endpointsCache;

const getEndpoints = keyName =>
  new Promise((resolve, reject) => {
    if (endpointsCache) {
      resolve(endpointsCache);
    } else {
      const ssm = new AWS.SSM();

      const params = {
        Name: keyName,
        WithDecryption: true,
      };

      ssm.getParameter(params, (error, data) => {
        if (error) {
          reject(error);
        } else {
          const value = Buffer.from(data.Parameter.Value, 'base64')
            .toString('ascii');
          endpointsCache = JSON.parse(value);
          resolve(endpointsCache);
        }
      });
    }
  });

module.exports.check = (event, context, callback) => {
  const outputs = {};
  const cloudwatch = new AWS.CloudWatch();
  const ssmKey = process.env.ENDPOINTS_BASE64_SSM_KEY;

  getEndpoints(ssmKey).then((endpoints) => {
    endpoints.forEach((endpoint) => {
      checkEndpoint(endpoint, (result) => {
        const params = asMetricData(result);
        cloudwatch.putMetricData(params, (error) => {
          if (error) {
            console.log('failed posting metrics to CloudWatch');
            console.log(error, error.stack);
          } else {
            console.log(`logged metrics to CloudWatch at: ${params.Namespace}`, result);
          }
          const key = `${result.method}:${result.endpoint}`;
          outputs[key] = result;
        });
      });
    });

    const wait = () => {
      console.log(Object.keys(outputs).length, endpoints.length);
      if (Object.keys(outputs).length < endpoints.length) {
        setTimeout(wait, 100);
        return;
      }
      callback(null, outputs);
    };

    wait();
  }).catch((error) => {
    console.log('Failed to fetch endpoints from SSM', error);
    callback(null);
  });
};
