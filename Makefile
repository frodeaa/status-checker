YARN ?= yarn --silent
YARN_SCRIPTS := lint test e2e/test e2e/create-stacks
COMPOSE_COMMANDS := down up

help:
	@printf "\033[36m%-42s\033[0m %s\n" "build $(YARN_SCRIPTS)" "yarn scripts"
	@printf "\033[36m%-42s\033[0m %s\n" "$(COMPOSE_COMMANDS)" "docker compose commands"

node_modules: package.json yarn.lock
	$(YARN)
	@touch $@

dist/%.js: src/%.ts
	$(YARN) build

build: node_modules dist/handler.js

e2e/test: build up
e2e/create-stack: build up
$(YARN_SCRIPTS): node_modules
	$(YARN) $@

up: ARGS:=--wait status-checker
down: ARGS:=--remove-orphans
$(COMPOSE_COMMANDS):
	docker compose $(subst dc-,,$@) $(ARGS)

.PHONY: $(COMPOSE_COMMANDS) $(YARN_SCRIPTS)
