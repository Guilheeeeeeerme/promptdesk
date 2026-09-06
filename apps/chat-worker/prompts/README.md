# Prompt registry

`registry.yml` is the source of truth for model-facing prompt text in the chat worker.

Each entry documents:

- `id`: stable lookup name used by code
- `kind`: system instruction, user template, or context template
- `purpose`: why the prompt exists
- `when`: the execution point that uses it
- `audience`: model workflow or human-facing workflow
- `variables`: values the renderer must receive
- `security`: boundaries the prompt must preserve
- `output_contract`: expected model behavior or shape
- `template`: the actual model-facing text

Guidelines, conversation history, and known facts are runtime data. They are passed through delimited context templates and are not system instructions.

When adding a prompt, add a metadata-completeness test and use `renderPrompt('<id>')` from application code. Do not duplicate prompt text in provider services.
