var watson = require('watson-developer-cloud');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var OpenCC = require('opencc');
var opencc = new OpenCC('s2t.json');

var username;
var password;
var model;
var logger;
var sttEngine;
var lang;
var writeStream;

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
         writeStream = sttEngine.createRecognizeStream({
            'content_type': 'audio/l16;rate=16000',
            //{   'content_type': 'audio/flac;rate=16000',
            'interim_results': true,
            'continuous': true,
            'inactivity_timeout': -1,
            'model': model
          });

        writeStream.on('connect', function(conn) {
            logger.info('Watson STT WS connected');

        });

        writeStream.on('results', function(data) {
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

        writeStream.on('error', function() {
            logger.error('stt error, connection has problem');

            // TODO: reconnect should be configurable
            self.connect();
        });

        writeStream.on('close', function(code, description) {
            logger.info('STT connection-closed,', code, description);
            self.connect();
        });

        writeStream.on('stopping', function() {
            logger.info('STT connection stopped.');
            self.connect();
        });

};


module.exports = WatsonSTT;