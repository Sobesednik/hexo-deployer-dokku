const deployer = require('../../lib/deployer');
const git = require('../../lib/git').git;
const assert = require('assert');
const path = require('path');
const fs = require('hexo-fs');
const os = require('os');

// setup
function getBaseDirName() {
    return path.join(os.tmpdir(), `__hexo_base_dir_${Date.now()}`);
}
function getLocalRemoteGitDirName() {
    return path.join(os.tmpdir(), `__hexo_dokku_repo_dir_${Date.now()}`);
}
function getFixturesDirName() {
    return path.join(__dirname, '..', 'fixtures', 'public');
}
function getPublicDirName() {
    return path.join(os.tmpdir(), `__hexo_public_dir_${Date.now()}`);
}
// console.log('base dir: %s', baseDir);
// console.log('local remote git dir: %s', localRemoteGitDir);
// console.log('fixtures dir: %s', fixturesDir);
// console.log('public dir: %s', publicDir);


function getGitDir(root) {
    return `${root}/.git`;
}

// fs promise interface via hexo-fs
function removeDir(dir) {
    return fs.rmdir(dir)
        .then(() => dir);
}
function ensureDir(dir) {
    return fs.ensurePath(dir)
        .then(() => dir);
}
function copyDir(from, to) {
    return fs.copyDir(from, to)
        .then(() => to);
}

function logAndReturn(data) {
    console.log(data);
    return data;
}

// setup testing directories
// 1. base_dir
function setupBase() {
    const baseDir = getBaseDirName();
    return ensureDir(baseDir)
        .then(logAndReturn);
}
// 2. public_dir, + copy files from test/fixtures/public
// This folder contains the results of `hexo publish`
function setupPublic() {
    const fixturesDir = getFixturesDirName();
    const publicDir = getPublicDirName();
    return ensureDir(publicDir)
        .then(() => copyDir(fixturesDir, publicDir))
        .then(logAndReturn);
}
// 3. local_remote_git - imitates a remote dokku repo
function setupLocalRemoteGit() {
    const localRemoteGit = getLocalRemoteGitDirName();
    return ensureDir(localRemoteGit)
        .then(() => git('init', { cwd: localRemoteGit }))
        .then(() => localRemoteGit)
        .then(logAndReturn);
}
// 4. all
function setupAll() {
    return Promise.all([
        setupBase(),
        setupPublic(),
        setupLocalRemoteGit(),
    ]);
}

// teardown testing directories
// 1. base_dir
function teardownBase(baseDir) {
    return removeDir(baseDir);
}
// 2. public_dir
function teardownPublic(publicDir) {
    return removeDir(publicDir);
}
// 3. local_remote_git
function teardownLocalRemoteGit(localRemoteGitDir) {
    return removeDir(localRemoteGitDir);
}
// 4. all
function teardownAll(baseDir, publicDir, localRemoteGitDir) {
    return Promise.all([
        teardownBase(baseDir),
        teardownPublic(publicDir),
        teardownLocalRemoteGit(localRemoteGitDir)
    ]);
}

const errorTestSuite = {
    'should throw an error if base_dir is missing': () =>
        deployer
            .call({
                public_dir: 'public_dir',
                log: {},
            })
            .then(() => {
                throw new Error('A missing base_dir error should have been thrown');
            })
            .catch(err => assert(err.message === 'base_dir is not found in context')),

    'should throw an error if public_dir is missing': () =>
        deployer
            .call({
                base_dir: 'base_dir',
                log: {},
            })
            .then(() => {
                throw new Error('A missing public_dir error should have been thrown');
            })
            .catch(err => assert(err.message === 'public_dir is not found in context')),

    'should throw an error if log is missing': () =>
        deployer
            .call({
                base_dir: 'base_dir',
                public_dir: 'public_dir',
            })
            .then(() => {
                throw new Error('A missing log error should have been thrown');
            })
            .catch(err => assert(err.message === 'log object is not found in context')),

    'should throw an error if args is not given': () =>
        deployer
            .call({
                base_dir: 'base_dir',
                public_dir: 'public_dir',
                log: {},
            })
            .then(() => {
                throw new Error('A missing args error should have been thrown');
            }).catch( err => assert(err.message === 'args object is not given')),

    'should export REPO_EXPECTED_ERROR variable': () =>
        assert(typeof deployer.REPO_EXPECTED_ERROR === 'string'),

    'should print an error if repo is not set': () => {
        let p;
        return new Promise((resolve) => {
            p = deployer.call({
                log: {
                    error: resolve,
                },
                base_dir: 'base_dir',
                public_dir: 'public_dir',
            }, {});
        })
        .then(p)
        .then((logData) => {
            const expected = `You have to configure the deployment settings in _config.yml first!

Example:
  deploy:
    type: dokku
    repo: <dokku@docker.me:hexo>

For more help, you can check the docs: http://hexo.io/docs/deployment.html`.trim();
            assert(logData === deployer.REPO_EXPECTED_ERROR);
            assert(logData === expected);
        });
    },
};

const gitTestSuite = {
    'should create .deploy_dokku directory': () =>
        // use async-await :+1:
        setupAll()
            .then((res) => {
                console.log(res);
                const baseDir = res[0];
                const publicDir = res[1];
                const localRemoteGit = res[2];
                const log = {
                    error: () => {},
                    info: () => {},
                };
                return deployer.call({
                    base_dir: baseDir,
                    public_dir: publicDir,
                    log,
                }, { repo: getGitDir(localRemoteGit) })
                    .then(() => fs.exists(path.join(baseDir, '.deploy_dokku')))
                    .then(assert)
                    .then(() => teardownAll(baseDir, publicDir, localRemoteGit));
            }),
};

const deployerTestSuite = {
    errorTestSuite,
    // gitTestSuite,


    // 'should add Dockerfile to .deploy_dokku': () =>
    //     createTmpDir(base_dir)
    //         .then(() => deployer.call({ base_dir, public_dir, log }, { repo: 'test-repo' }))
    //         .then(() => fs.exists(path.join(base_dir, 'deploy_dokku', 'Dockerfile')))
    //         .then(assert)
    //         .then(() => removeTmpDir(base_dir)),

    // 'should add nginx.conf to .deploy_dokku': () =>
    //     createTmpDir(base_dir)
    //         .then(() => deployer.call({ base_dir, public_dir, log }, { repo: 'test-repo' }))
    //         .then(() => fs.exists(path.join(base_dir, 'deploy_dokku', 'nginx.vh.default.conf')))
    //         .then(assert)
    //         .then(() => removeTmpDir(base_dir)),

    'should init git in the .deploy_dokku directory': () => {
    },
    'should add files from public dir to .deploy_dokky': () => {
    },
};

module.exports = deployerTestSuite;
