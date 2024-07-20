YARN ?= yarn --silent
YARN_SCRIPTS := lint test
COMPOSE_COMMANDS := down up

help:
	@printf "\033[36m%-30s\033[0m %s\n" "build $(YARN_SCRIPTS)" "run yarn scripts"
	@printf "\033[36m%-30s\033[0m %s\n" "$(COMPOSE_COMMANDS)" "run docker compose commands"
	@printf "\033[36m%-30s\033[0m %s\n" "end-to-end-tests" "run end-to-end-tests"

node_modules: package.json yarn.lock
	$(YARN)
	@touch $@

dist/%.js: src/%.ts
	$(YARN) build

build: node_modules dist/handler.js

$(YARN_SCRIPTS): node_modules
	$(YARN) $@

up: ARGS:=--wait status-checker
down: ARGS:=--remove-orphans
$(COMPOSE_COMMANDS):
	docker compose $(subst dc-,,$@) $(ARGS)

end-to-end-tests: build up
	$(YARN) run $@

end-to-end-tests/create-stacks: build up
	./$@.sh

.PHONY: $(COMPOSE_COMMANDS) $(YARN_SCRIPTS) end-to-end-tests
