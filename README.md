# GitHub Push Button

Adds a VS Code status bar button that stages changes, commits them, and pushes the current workspace repository to GitHub.

## Usage

1. Open a folder that is already a Git repository with a configured `origin` remote.
2. Make changes.
3. Click `$(cloud-upload) Push Code` in the status bar.
4. Enter a commit message when prompted.

The extension uses your local `git` command and existing GitHub authentication.

## Development

```sh
npm install
npm run compile
```

Then open this folder in VS Code and run the extension in an Extension Development Host.
