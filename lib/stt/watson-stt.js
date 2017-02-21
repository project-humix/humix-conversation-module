var watson = require('watson-developer-cloud');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Transform = require('stream').Transform;

var OpenCC = require('opencc');
var opencc = new OpenCC('s2t.json');

var username;
var password;
var model;
var logger;
var sttEngine;
var lang;

var currentSession;
var writeStream = new Transform({
    objectMode: true,
    transform: function(chunk, enc, cb) {
        this.push(chunk);
        cb();
    }
});

var WatsonSTT = function Watson(){

    console.log('created waton stt instance');

};
util.inherits(WatsonSTT, EventEmitter);

WatsonSTT.prototype.init = function(config, parentLogger) {

        this.config = config;
        logger = parentLogger.child({
            loc: 'WatsonSTT'
        });

        username = config.stt.watson.username;
        password = config.stt.watson.passwd;

        lang = config.lang;
        if (lang == 'cht' || lang == 'chs') {
            model = 'zh-CN_BroadbandModel';
        } else if (lang == 'en') {
            model = 'en-US_BroadbandModel';
        }

        sttEngine = watson.speech_to_text({
            'username': username,
            'password': password,
            version: 'v1',
            url: 'https://stream.watsonplatform.net/speech-to-text/api'
        });

        this.connect();

        logger.info('inited watson stt. Model:', model);
};

WatsonSTT.prototype.write = function (data){

        writeStream.write(data);

};

WatsonSTT.prototype.connect = function(){

        logger.debug('connecting..');

        var self = this;

        currentSession = sttEngine.createRecognizeStream({
            'content_type': 'audio/l16;rate=16000',
            //{   'content_type': 'audio/flac;rate=16000',
            'interim_results': true,
            'continuous': true,
            'inactivity_timeout': -1,
            'model': model
        });

        writeStream.pipe(currentSession);
        writeStream.uncork();

        currentSession.on('connect', function(conn) {
            logger.info('Watson STT WS connected');
        });

        currentSession.on('results', function(data) {
            var index = data.results.length ? data.results.length - 1 : 0;
            if (data.results[index] && data.results[index].final &&
                data.results[index].alternatives) {

                var response = data.results[index].alternatives[0].transcript;
                if (lang == 'cht'){

                    response = opencc.convertSync(response).replace(/ /g,'');
                }
                self.emit('msg', response);
            }
        });

        currentSession.on('error', function() {

            logger.error('STT error, connection has problem');

            writeStream.unpipe();
            currentSession.end();
            currentSession = null;
        });

        currentSession.on('end', function(code, description) {

            logger.info('STT connection-closed,', code, description);

            writeStream.unpipe();
            currentSession.end();
            currentSession = null;

        });

};

WatsonSTT.prototype.disconnect = function(){

    logger.info('disconnecting ... ');
    writeStream.unpipe();

    if(currentSession){

        currentSession.end();
        currentSession = null;
    }

};


WatsonSTT.prototype.reconnect = function(){

    logger.info('reconnecting ... ');

    writeStream.cork();
    if(!currentSession){
        logger.debug('ready to reconnect');
        this.connect();
    }

};

module.exports = WatsonSTT;