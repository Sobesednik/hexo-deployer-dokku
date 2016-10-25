const deployer = require('./lib/deployer');

hexo.extend.deployer.register('dokku', deployer);

