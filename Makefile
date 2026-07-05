.PHONY: help install serve build docs tools-docs clean

VENV   := .venv-docs
PIP    := $(VENV)/bin/pip
MKDOCS := $(VENV)/bin/mkdocs

.DEFAULT_GOAL := help

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

$(VENV)/bin/activate:
	python3 -m venv $(VENV)

install: $(VENV)/bin/activate ## Create .venv-docs and install docs dependencies
	@$(PIP) install --quiet --upgrade pip
	@$(PIP) install --quiet -r requirements-docs.txt
	@echo "Docs environment ready."

tools-docs: ## Regenerate docs/tools/*.md from tools/registry.ts
	npx tsx scripts/generate-tool-docs.ts

docs: tools-docs build ## Regenerate and build documentation

serve: install ## Preview docs at http://127.0.0.1:8000 (auto-reload)
	$(MKDOCS) serve

build: install ## Build the production site to ./site (same as CI --strict)
	$(MKDOCS) build --strict

clean: ## Remove venv and build output
	rm -rf $(VENV) site/
