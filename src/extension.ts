import * as vscode from 'vscode';
import { execFile } from 'node:child_process';

type GitResult = {
  stdout: string;
  stderr: string;
};

const commandId = 'githubPushButton.pushCode';

export function activate(context: vscode.ExtensionContext): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(cloud-upload) Push Code';
  statusBarItem.tooltip = 'Stage, commit, and push this workspace to GitHub';
  statusBarItem.command = commandId;
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand(commandId, pushCode)
  );
}

export function deactivate(): void {
  // No cleanup needed. VS Code disposes subscriptions registered in activate().
}

async function pushCode(): Promise<void> {
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Open a workspace folder before pushing code.');
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Pushing code to GitHub',
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: 'Checking repository...' });
        const repoRoot = (await runGit(['rev-parse', '--show-toplevel'], workspaceFolder.uri.fsPath)).stdout.trim();

        progress.report({ message: 'Checking changes...' });
        const status = (await runGit(['status', '--porcelain'], repoRoot)).stdout.trim();

        if (status.length > 0) {
          const commitMessage = await vscode.window.showInputBox({
            prompt: 'Commit message',
            value: 'Update code',
            ignoreFocusOut: true,
            validateInput: (value) => value.trim().length === 0 ? 'Commit message cannot be empty.' : undefined
          });

          if (commitMessage === undefined) {
            vscode.window.showInformationMessage('Push cancelled.');
            return;
          }

          progress.report({ message: 'Staging changes...' });
          await runGit(['add', '-A'], repoRoot);

          progress.report({ message: 'Creating commit...' });
          await runGit(['commit', '-m', commitMessage.trim()], repoRoot);
        }

        progress.report({ message: 'Pushing branch...' });
        await pushCurrentBranch(repoRoot);

        vscode.window.showInformationMessage('Code pushed to GitHub.');
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Push failed: ${formatError(error)}`);
  }
}

function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const activeDocument = vscode.window.activeTextEditor?.document.uri;
  if (activeDocument) {
    const activeFolder = vscode.workspace.getWorkspaceFolder(activeDocument);
    if (activeFolder) {
      return activeFolder;
    }
  }

  return vscode.workspace.workspaceFolders?.[0];
}

async function pushCurrentBranch(repoRoot: string): Promise<void> {
  const branch = (await runGit(['branch', '--show-current'], repoRoot)).stdout.trim();
  if (branch.length === 0) {
    throw new Error('Cannot push because the current Git state is detached from a branch.');
  }

  try {
    await runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], repoRoot);
  } catch {
    await runGit(['push', '-u', 'origin', branch], repoRoot);
    return;
  }

  await runGit(['push'], repoRoot);
}

function runGit(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      const result = {
        stdout,
        stderr
      };

      if (error) {
        reject(new Error(stderr.trim() || stdout.trim() || error.message));
        return;
      }

      resolve(result);
    });
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
