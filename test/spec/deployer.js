const deployer = require('../../lib/deployer');
const git = require('../../lib/git').git;
const assert = require('assert');
const path = require('path');
const fs = require('hexo-fs');
const os = require('os');
const EOL = os.EOL;

// setup
function getBaseDirName() {
    return path.join(os.tmpdir(), '__hexo_base_dir__');
}
function getLocalRemoteGitDirName() {
    return path.join(os.tmpdir(), '__hexo_dokku_repo_dir__');
}
function getLocalGitWorkTreeDirName() {
    return path.join(os.tmpdir(), '__hexo_dokku_repo_worktree_dir__');
}
function getFixturesDirName() {
    return path.join(__dirname, '..', 'fixtures', 'public');
}
function getPublicDirName() {
    return path.join(os.tmpdir(), '__hexo_public_dir__');
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
    log({
        removeDir: {
            data: dir,
            status: 'begin',
        },
    });
    return fs.rmdir(dir)
        .then(() => dir) // otherwiser it does not resolve anything
        .then(data => Promise.all([
            data,
            log({
                removeDir: {
                    data,
                    status: 'complete'
                }
            }),
        ]))
        .then(res => res[0]);
}

// Find a dir name with ensurePath, call mkdirs, and resolve with found name
function ensureDir(dir) {
    log({
        ensureDir: {
            data: dir,
            status: 'begin'
        },
    });
    return fs.ensurePath(dir)
        .then(data => Promise.all([data, fs.mkdirs(data)]))
        .then(res => res[0]) // get path because makedirs does not resolve it
        .then(data => Promise.all([
            data,
            log({
                ensureDir: {
                    data: {
                        requested: dir,
                        ensured: data,
                    },
                    status: 'complete',
                },
            })
        ]))
        .then(res => res[0]);
}

function copyDir(from, to) {
    log({
        copyDir: {
            data: { from, to },
            status: 'begin',
        },
    });
    return fs.copyDir(from, to)
        .then(data => Promise.all([
            data,
            log({
                copyDir: {
                    data,
                    status: 'complete',
                },
            })
        ]))
        .then(data => ({ from, to, files: data }));
}

function log(data) {
    console.log(data);
}

function logAndReturn(data, comment, useNewLine) {
    if (comment !== undefined) {
        console.log(comment, useNewLine ? `${EOL}${data}` : data);
    } else {
        console.log(' - %s', data);
    }
    return data;
}

// setup testing directories
// 1. base_dir
// This this the `hexo-blog` directory
function setupBase() {
    const baseDir = getBaseDirName();
    log({
        setupBase: {
            data: baseDir,
            status: 'begin',
        },
    });
    return ensureDir(baseDir)
        .then(data => Promise.all([
            data,
            log({
                setupBase: {
                    data,
                    status: 'complete',
                },
            }),
        ]))
        .then(res => res[0]);
}
// 2. public_dir, + copy files from test/fixtures/public
// This folder contains the results of `hexo publish`
function setupPublic() {
    const fixturesDir = getFixturesDirName();
    const publicDir = getPublicDirName();

    log({
        setupPublic: {
            data: { fixturesDir, publicDir },
            status: 'begin',
        },
    });
    return ensureDir(publicDir)
        .then(ensuredPublicDir => copyDir(fixturesDir, ensuredPublicDir))
        .then(data => Promise.all([
            data,
            log({
                setupPublic: {
                    data,
                    status: 'complete',
                },
            })
        ]))
        .then(res => res[0])
        .then(data => data.to);
}
// 3. local_remote_git - imitates a remote dokku repo
// set up a temp dir to push files to
function setupLocalRemoteGit() {
    const localRemoteGit = getLocalRemoteGitDirName();
    log({
        setupLocalRemoteGit: {
            data: localRemoteGit,
            status: 'begin',
        },
    });
    return ensureDir(localRemoteGit)
        .then(data => Promise.all([
            data,
            git(['init', '--bare'], { cwd: data })
                .then(gitData =>
                    assert(/Initialized empty Git repository/.test(gitData.stdout),
                    `Could not initialise a bare git repository: ${gitData.stderr}`)
                )
        ]))
        .then(res => res[0])
        .then(data => Promise.all([
            data,
            setupLocalRemoteGitWorkTree(data),
        ]))
        .then(res => ({
            localBareRepo: res[0],
            localClonedRepo: res[1],
        }))
        .then(data => Promise.all([
            data,
            log({
                data,
                status: 'complete',
            }),
        ]))
        .then(res => res[0]);
}
// 3.5. localGitWorkTreeDirName -- directory into which we will clone `bare` remote git
function setupLocalRemoteGitWorkTree(bareRepo) {
    const localRemoteGitWorkTree = getLocalGitWorkTreeDirName();
    log({
        setupLocalRemoteGitWorkTree: {
            data: localRemoteGitWorkTree,
            status: 'begin',
        },
    });
    return ensureDir(localRemoteGitWorkTree)
        .then(data =>
            git('init', { cwd: data })
                .then(() => git(['remote', 'add', 'origin', bareRepo], { cwd: data }))
                .then(() => data)
        )
        .then(data => Promise.all([
            data,
            log({
                setupLocalRemoteGitWorkTree,
                status: 'end',
            }),
        ]))
        .then(res => res[0]);
}

// 4. all
function setupAll() {
    const allPromise = Promise
        .all([
            setupBase(),
            setupPublic(),
            setupLocalRemoteGit(),
        ]);
    log({
        setupAll: {
            data: ['setupBase', 'setupPublic', 'setupLocalRemoteGit', 'setupLocalRemoteGitWorkTree'],
            status: 'begin',
        },
    });
    return allPromise
        .then(data => Promise.all([
            data,
            log({
                setupAll: {
                    data,
                    status: 'complete',
                },
            }),
        ]))
        .then(res => res[0]);
}

// teardown testing directories
// 1. base_dir
function teardownBase(baseDir) {
    log({
        teardownBase: {
            data: baseDir,
            status: 'begin',
        },
    });
    return removeDir(baseDir)
        .then(data => Promise.all([
            data,
            log({
                teardownBase: {
                    data,
                    status: 'complete',
                },
            }),
        ]))
        .then(res => res[0]);
}
// 2. public_dir
function teardownPublic(publicDir) {
    log({
        teardownPublic: {
            data: publicDir,
            status: 'beign',
        },
    });
    return removeDir(publicDir)
        .then(data => Promise.all([
            data,
            log({
                teardownPublic: {
                    data,
                    status: 'complete',
                },
            })
        ]))
        .then(res => res[0]);
}
// 3. local_remote_git
function teardownLocalRemoteGit(localRemoteGitDir) {
    log({
        teardownLocalRemoteGit: {
            data: localRemoteGitDir,
            status: 'beign',
        },
    });
    return removeDir(localRemoteGitDir)
        .then(data => Promise.all([
            data,
            log({
                teardownLocalRemoteGit: {
                    data,
                    status: 'complete',
                },
            })
        ]))
        .then(res => res[0]);
}
// 3.5 local_remote_git_work_tree
function teardownLocalRemoteGitWorkTree(localRemoteGitWorkTree) {
    log({
        teardownLocalRemoteGitWorkTree: {
            data: localRemoteGitWorkTree,
            status: 'begin',
        },
    });
    return removeDir(localRemoteGitWorkTree)
        .then(data => Promise.all([
            data,
            log({
                teardownLocalRemoteGitWorkTree: {
                    data,
                    status: 'complete',
                },
            })
        ]))
        .then(res => res[0]);
}
// 4. all
function teardownAll(baseDir, publicDir, localRemoteGitDir, localRemoteGitWorkTreeDir) {
    const allPromise = Promise.all([
        teardownBase(baseDir),
        teardownPublic(publicDir),
        teardownLocalRemoteGit(localRemoteGitDir),
        teardownLocalRemoteGitWorkTree(localRemoteGitWorkTreeDir)
    ]);
    log({
        teardownAll: {
            data: { baseDir, publicDir, localRemoteGitDir, localRemoteGitWorkTreeDir},
            status: 'begin',
        },
    });
    return allPromise
        .then(data => Promise.all([
            data,
            log({
                teardownAll: {
                    data,
                    status: 'complete',
                },
            })
        ]))
        .then(res => res[0]);
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
                const baseDir = res[0];
                const publicDir = res[1];
                const localRemoteBareGit = res[2].localBareRepo;
                const localRemoteWorkTreeGit = res[2].localClonedRepo;

                const logData = { error: [], info: [] };
                const log = {
                    error: data => { logData.error.push(data); },
                    info: data => { logData.info.push(data); },
                };
                return deployer.call({
                    base_dir: baseDir,
                    public_dir: publicDir,
                    log,
                }, { repo: localRemoteBareGit })
                    .then(() => fs.exists(path.join(baseDir, '.deploy_dokku')))
                    .then(assert)
                    .then(() => teardownAll(
                        baseDir,
                        publicDir,
                        localRemoteBareGit,
                        localRemoteWorkTreeGit
                    ));
            }),
    'should initialise git in the .deploy_dokku directory': () =>
        setupAll()
             .then((res) => {
                 const baseDir = res[0];
                 const publicDir = res[1];
                 const localRemoteBareGit = res[2].localBareRepo;
                 const localRemoteWorkTreeGit = res[2].localClonedRepo;
                 const dokkuDir = path.join(baseDir, '.deploy_dokku');

                 const logData = { error: [], info: [] };
                 const log = {
                     error: data => { logData.error.push(data); },
                     info: data => { logData.info.push(data); },
                 };
                 return deployer.call({
                     base_dir: baseDir,
                     public_dir: publicDir,
                     log,
                 }, { repo: localRemoteBareGit })
                    .then(() => git(['rev-parse', '--is-inside-work-tree'], { cwd: dokkuDir }))
                    .then(gitData => assert(gitData.stdout === 'true'))
                    .then(() => teardownAll(
                        baseDir,
                        publicDir,
                        localRemoteBareGit,
                        localRemoteWorkTreeGit
                    ));
             }),

    'should add remote git to the directory as dokku': () =>
        setupAll()
             .then((res) => {
                 const baseDir = res[0];
                 const publicDir = res[1];
                 const localRemoteBareGit = res[2].localBareRepo;
                 const localRemoteWorkTreeGit = res[2].localClonedRepo;
                 const dokkuDir = path.join(baseDir, '.deploy_dokku');

                 const logData = { error: [], info: [] };
                 const log = {
                     error: data => { logData.error.push(data); },
                     info: data => { logData.info.push(data); },
                 };
                 return deployer.call({
                     base_dir: baseDir,
                     public_dir: publicDir,
                     log,
                 }, { repo: localRemoteBareGit })
                    .then(() => git(['remote', '-v'], { cwd: dokkuDir }))
                    .then(gitData => assert(
                        new RegExp(`dokku\\s+${localRemoteBareGit}`).test(gitData.stdout))
                    )
                    .then(() => teardownAll(
                        baseDir,
                        publicDir,
                        localRemoteBareGit,
                        localRemoteWorkTreeGit
                    ));
             }),
};

const deployerTestSuite = {
    // 'should export LOCAL_DOKKU_DEPLOY_DIR_NAME variable': () =>
    //     assert(typeof deployer.LOCAL_DOKKU_DEPLOY_DIR_NAME === 'string'),

    // errorTestSuite,
    gitTestSuite,


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
