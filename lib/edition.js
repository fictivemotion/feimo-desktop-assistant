'use strict';
const pkg=require('../package.json');
const xiaowen=pkg.feimoEdition==='xiaowen';
module.exports=Object.freeze({id:xiaowen?'xiaowen':'standard',name:xiaowen?'斐墨 · 小文特别版':'斐墨',coding:!xiaowen,privateBundle:pkg.version.endsWith('-personal')||xiaowen});
