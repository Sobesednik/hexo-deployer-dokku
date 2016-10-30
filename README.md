# hexo-deployer-dokku
Dokku deployer plugin for Hexo.

## Install 
```bash
npm i --save hexo-deployer-dokku
```

Add to `_config.yml` :
```
# Deployment
## Docs: https://hexo.io/docs/deployment.html
deploy:
  type: dokku
  repo: dokku@doker.me:blog
```

Publish
`hexo generate`

Push
`hexo deploy`

Or publish and push
`hexo generate --deploy
`

## How it works
The main Docker image is based on nginx:alpine, that is minimal linux with
nginx server. The config files are found in /etc/folder: `Dockerfile` and
`nginx.conf`. Server is hard-coded to listen on port 5000. 

Also you should use dokku `letsencrypt` plugin to get instand ssl on your 
blog.

It works by creating a `.deploy_dokku` directory in `base_dir`, i.e., your
main directory with the blog, initialises a .git in it, coppies new files 
after every publish, and commits. If no new files were copied, a commit will
not be made and won't be pushed to remote. The push to remote is done with the
`git push --set-upstream ${config.repo} master --force`.

## Testing
The project is tested with `zoroaster`. A temporary directory will be created
in the `os.temp()` to be used as `base_dir`, and `./test/fixtures` contain the
`public_dir`, which has 2 files: `index.html` and image.jpg. They will be expected
to be commited. The push will happen into a local directory, which is served to be
the `remote`: 

```
function generateDeployDirName() {
    return `_hexo_test_deploy_dir_${Date.now();}`;
}
function getDeployDirFullPath(getTempFn, joinFn, dirNameFn) {
    const name = dirNameFn();
    const temp = getTempFn();
    returh joinFn(temp, name);
}

function getGitDir(root) {
    return `${root}/.git`;
}

const deploy_dir = getDeployDirFullPath(os.temp, path.join, generateDeployDirName);
const local_git_deploy_dir = getGitDir(deploy_dir);

function getDeployDokkuDirName() {
    return '.deploy_dokku';
}
const local_dokku_repo = getDokkuBase(path.join, args.base_dir, getDeployDokkuDirName);

function getDokkuBase(join, base_dir, getDokkuDirNameFn) {
    return join(base_dir, getDokkuDirNameFn());
}
;
```
git(["push", "--set-upstream", local_git_deploy_dir, "master", "--force"],
    local_dokku_repo);
```

## Git command
```js
function git(args, dir, logFn) {
	return new Promise((resolve, reject) => {
        const git = cp.spawn('git', args, { cwd: dir });
        git.on('close', (code) => {
            if (code !== 0) {
                return reject(`git exited with code ${code}`);
            }
            return resolve(dir);
        });
        git.stdout.on('data', data => logFn(data.toString().trim()));
        git.stderr.on('data', data => logFn(data.toString().trim()));
    });
}

```

## Log function
`this.log` object is used for logging. 
It must contain 
```
const log = {
    info: () => {},
    error: () => {},
};
```





After that, tests cases will generat

## TODO
- git branches
- better log

