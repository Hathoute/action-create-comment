import * as github from '@actions/github';
import * as core from '@actions/core';

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github_token', { required: true });
    const body = core.getInput('body', { required: true });

    const octokit = github.getOctokit(githubToken);

    let { owner, repo } = github.context.repo;
    if (core.getInput('repo')) {
      [owner, repo] = core.getInput('repo').split('/');
    }

    const commentUid = core.getInput('comment_uid') === ''
      ? undefined
        : parseInt(core.getInput('comment_uid'));

    const pullNumber =
        core.getInput('number') === ''
            ? github.context.issue.number
            : parseInt(core.getInput('number'));

    let githubCommentId: number | null = null;
    if (commentUid != undefined) {
      await octokit.issues.listComments({
        owner,
        repo,
        issue_number: pullNumber
      }).then(payload => {
        let comments = payload.data.filter(c => c.body.includes(`cuid=${commentUid})`));
        core.debug(`Found ${payload.data.length} comments in PR #${pullNumber}.`);
        core.debug(`Of which ${comments.length} satisfy the comment_uid condition.`)
        if (comments.length > 0) {
          githubCommentId = comments[0].id;
          core.debug(`Github comment id found: ${githubCommentId}`);
        }
        if (comments.length > 1) {
          core.debug(`Illegal State: Found multiple comments with the same comment_uid ${commentUid}`);
          core.debug(`Will use the first github comment id found: ${githubCommentId}`)
        }
      });
    }

    const commentBody = createCommentBody(body, commentUid);
    core.debug(`Comment body: ${commentBody}`);
    if (githubCommentId == null) {
      core.debug(`Creating new comment`);
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body: commentBody
      });
    }
    else {
      core.debug(`Updating [comment_uid ${commentUid}, comment_id ${githubCommentId}]`);
      await octokit.issues.updateComment({
        owner,
        repo,
        comment_id: githubCommentId,
        body: commentBody
      });
    }
  } catch (e) {
    core.error(e);
    core.setFailed(e.message);
  }
}

function createCommentBody(body: string, commentUid?: number) : string {
  if (commentUid == undefined) {
    return body;
  }

  return body + `\n\n[This comment is auto-generated](https://github.com/Hathoute/action-create-comment?cuid=${commentUid})`;
}

run();
