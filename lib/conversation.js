
var mic = require('mic');
var StateMachine = require('javascript-state-machine');
var EventEmitter = require('events').EventEmitter;
var crypto = require('crypto');
var wav = require('wav');
var util = require('util');
var fs = require('fs')
var path = require('path');
var execSync = require('child_process').execSync;

var logger;

/**
 *
 *  STATE MACHINE Configuration
 *
 */

var defaultStateConfig = {
    initial: 'init',
    events: [{
        name: 'ready',
        to: 'listen'
    }, {
        name: 'data',
        from: ['sleep', 'listen'],
        to: 'listen'
    }, {
        name: 'data',
        from: ['suspend'],
        to: 'suspend'
    }, {
        name: 'suspend',
        from: ['sleep'],
        to: 'sleep'
    }, {
        name: 'suspend',
        from: ['listen', 'suspend'],
        to: 'suspend'
    },{
        name: 'speak',
        from: ['sleep', 'listen'],
        to: 'speak'

    },{
        name: 'speak',
        from: ['suspend'],
        to: 'suspend'
    },
    {
        name: 'silence',
        to: 'sleep'
    }],
    callbacks: {

        onready: function(event, from, to) {
            logger.info('transit from ' + from + ' to ' + to);
        },
        ondata: function(event, from, to) {
            logger.debug('start receiving data....');
        },
        onsleep: function(event, from, to) {
            logger.info('No activity. Sleep');
            //playSound('sleep');
        }
    }
}

var fsm = StateMachine.create(defaultStateConfig);

/**
 *
 * Utilities Functions
 */

function playSound(file) {

    var filename = path.join(__dirname, 'voice', file + '.wav');
    playFile(filename);

}

function playFile(filename) {

    execSync('play -q ' + filename);
}


/**
 *
 *  Humix MIC Module Impl
 *
 */

var Conversation = function Conversation(option, log) {


    logger = log;
    this.config = option;

    if(!logger){
        logger = require('humix-logger').createLogger('conversation', { consoleLevel: 'debug', filename: 'conversation.log' });
    }

    logger.info('Conversation instance created.');
}

util.inherits(Conversation, EventEmitter);

Conversation.prototype.init = function() {


    var self = this;

    console.info("using config:" + JSON.stringify(self.config));

    if(self.config['stt-engine']){

        logger.info('Using stt-engine:'+ self.config['stt-engine']);
        var STT = require('./stt/'+self.config['stt-engine']+'-stt');

        self.sttEngine = new STT();
        self.sttEngine.init(self.config, logger);

        self.sttEngine.on('msg', function(msg){
            playSound('processing');

            logger.debug('received message:'+msg);
            self.emit('msg',msg);
        })

        self.initMic();
    }

    // Initialize TTS Engine

    if(self.config['tts-engine']){

        logger.info('Using tts-engine:'+ self.config['tts-engine']);
        self.ttsEngine = require('./tts/'+self.config['tts-engine'] +'-tts');
        self.ttsEngine.init (self.config, logger);
    }

    fsm.ready();
};

var micInstance;
var micInputStream;
var dataChunk = 0;

Conversation.prototype.initMic = function () {

    var self = this;

    micInstance = mic({
        'rate': '16000',
        'channels': '1',
        'debug': false,
        'exitOnSilence': 100
    }, logger);

    micInputStream = micInstance.getAudioStream();

    if(self.config.debug)
       micInputStream.pipe(new wav.FileWriter('debug.wav'));

    /**
     *
     *  MIC EVENT HANDLING
     *
     */


    micInputStream.on('data', function(data) {

        //console.log('Recieved Input Stream of Size %d: %d', data.length, dataChunk++);
        //console.log('data:' + data);

        if (fsm.current === 'listen') {
            self.sttEngine.write(data);
        }
    });

    micInputStream.on('error', function(err) {
        logger.error('Error in Input Stream: ' + err);
    });

    micInputStream.on('startComplete', function() {
        logger.debug('Got SIGNAL startComplete');
    });

    micInputStream.on('stopComplete', function() {
        logger.debug('Got SIGNAL stopComplete');
    });

    micInputStream.on('pauseComplete', function() {
        logger.debug('Got SIGNAL pauseComplete');
    });

    micInputStream.on('resumeComplete', function() {
        logger.debug('Got SIGNAL resumeComplete');
    });

    micInputStream.on('startSpeech', function() {
        logger.debug('Got SIGNAL speech-start');
        if(fsm.current != 'suspend') {
            fsm.data();
        }
    });

    micInputStream.on('silence', function() {
        logger.info('Got SIGNAL silence');
        fsm.silence();

    });

    micInputStream.on('processExitComplete', function() {
        logger.info('Got SIGNAL processExitComplete');
    });

    micInstance.start();
}


Conversation.prototype.stopListening = function() {

    fsm.suspend();
    logger.info('Suspend HumixMic');
};

Conversation.prototype.resumeListening = function() {

    fsm.ready();
    logger.info('Resume HumixMic');
};

Conversation.prototype.say = function(input) {

    var wav_file;
    var text
    var cachePath = path.join(__dirname, 'voice/cache/');

    if(typeof input === 'object') {

        try {
            text = JSON.parse(input).text;
        }
        catch (e) {
            log.error('invalid JSON format. Error:', e);
            return;
        }
    }
    else{

        text = input;
    }

    // make sure there is no tailing spaces
    text = text.trim();

    logger.debug('text to say:' + text);

    fsm.suspend();
    var hash = crypto.createHash('md5').update(text).digest('hex');
    var filename = path.join(cachePath, hash + '.wav');

    if (fs.existsSync(filename)) {
        logger.debug('Wav file exist. Play cached file:', filename);

        playFile(filename);
        fsm.ready();
    } else {
        logger.debug('Wav file does not exist');

         this.ttsEngine.tts(text, filename).then(function(){

            playFile(filename);
            fsm.ready();
        });
    }
}


module.exports = Conversation;
