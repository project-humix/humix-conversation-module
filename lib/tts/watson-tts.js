// Watson TTS Processing
var watson = require('watson-developer-cloud');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var wav = require('wav')

var ttsEngine;
var logger;

var WatsonTTS = {


    init: function(config, parentLogger) {

        logger = parentLogger.child({loc: 'WatsonTTS'});


        ttsEngine = watson.text_to_speech({
            username: config.tts.watson.username,
            password: config.tts.watson.passwd,
            version: 'v1',
        });

        logger.info('inited watson tts');
    },

    tts: function(text, filename) {
        logger.debug('watson tts. text:' ,text, ' filename:', filename);

        return new Promise(function(resolve, reject) {

            var writer = new wav.FileWriter(filename,{'sampleRate':16000, 'channels':1});

            var out = ttsEngine.synthesize({
                text: text,
                accept: 'audio/wav;rate=16000'
                //accept: 'audio/ogg;codecs=opus'
            }).pipe(writer);

            out.on('finish', function (){

                logger.debug('tts synthesize completed');
                writer.end();
                resolve(filename);
            })

        });

    }


}

module.exports = WatsonTTS;