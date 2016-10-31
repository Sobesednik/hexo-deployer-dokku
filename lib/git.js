'use strict';

const cp = require('child_process');
const stream = require('stream');
const StringDecoder = require('string_decoder').StringDecoder;
const EventEmitter = require('events');

// no error checks here
function createGitPromise(args, opts) {
    return new Promise((resolve, reject) => {
        const git = cp.spawn('git', args, opts);
        const res = {
            stdout: '',
            stderr: '',
        };
        const stdoutDecoder = new StringDecoder('utf8');
        const stderrDecoder = new StringDecoder('utf8');

        git.on('close', (code) => {
            if (code !== 0) {
                return reject({
                    code,
                    stdout: res.stdout.trim(),
                    stderr: res.stderr.trim(),
                });
            }
            // write final data
            res.stdout += stdoutDecoder.end();
            res.stderr += stderrDecoder.end();

            return resolve({
                stdout: res.stdout.trim(),
                stderr: res.stderr.trim(),
            });
        });

        const stdoutCallback = data => { res.stdout += data; };
        const stderrCallback = data => { res.stderr += data; };

        const stdoutListener = createDataListener(git.stdout, stdoutDecoder, stdoutCallback);
        const stderrListener = createDataListener(git.stderr, stderrDecoder, stderrCallback);
    });

}

function git(args, options) {
    const argArray = [];
    // if args is an array, use it, otherwise use strings
    if (Array.isArray(args)) {
        args
            .forEach((arg) => {
                if (typeof arg === 'string') {
                    argArray.push(arg);
                }
            });
    } else if (typeof args === 'string') {
        argArray.push(args);
    }

    const opts = {
        cwd: process.cwd(),
    };
    // if options is an object, and options.cwd is a string, use them. otherwise use process.cwd()
    if (typeof options === 'object') {
        if ('cwd' in options && typeof options.cwd === 'string') {
            opts.cwd = options.cwd;
        }
    }
    console.log(JSON.stringify({
        git: {
            data: {
                argArray,
                options,
            },
            status: 'start',
        },
    }, null, 2));
    return createGitPromise(argArray, options)
        .then(data => Promise.all([
            data,
            console.log({
                git: {
                    data,
                    status: 'end',
                },
            }),
        ]))
        .then(res => res[0]);
}

// wrap strings in object to modify them
function createDataListener(stream, decoder, callback) {
    const handler = (data) => {
        const chunk = decoder.write(data);
        callback(chunk);
    };
    stream.on('data', handler);
    return { data: handler };
}

class Git {
    constructor(cwd) {
        this.options = { cwd };
    }
    run(args) {
        return git(args, this.options);
    }
}

module.exports = { git, Git };

