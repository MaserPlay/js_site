interface CommitAuthor {
    name: string;
    email: string;
    date: string;
}

interface CommitTree {
    sha: string;
    url: string;
}

interface Verification {
    verified: boolean;
    reason: string;
    signature: null | string;
    payload: null | string;
    verified_at: null | string;
}

interface Commit {
    author: CommitAuthor;
    committer: CommitAuthor;
    message: string;
    tree: CommitTree;
    url: string;
    comment_count: number;
    verification: Verification;
}

interface User {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    user_view_type: string;
    site_admin: boolean;
}

interface Parent {
    sha: string;
    url: string;
    html_url: string;
}

interface GitHubCommit {
    sha: string;
    node_id: string;
    commit: Commit;
    url: string;
    html_url: string;
    comments_url: string;
    author: User;
    committer: User;
    parents: Parent[];
}

type GitHubCommits = GitHubCommit[]