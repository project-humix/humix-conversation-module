var EventEmitter = require('events').EventEmitter;
var util = require('util');
var path = require('path');

var grpc = require('grpc');
var googleProtoFiles = require('google-proto-files');
var googleAuth = require('google-auto-auth');
var Transform = require('stream').Transform;

var host = 'speech.googleapis.com';
var model;
var logger;

var writeStream;
var currentSession;

// [START proto]

var PROTO_ROOT_DIR = googleProtoFiles('..');
var writeStream = new Transform({
    objectMode: true,
    transform: function(chunk, enc, cb) {
        var content = {
            audioContent: chunk
        }
        this.push(content);
        cb();

    }
});

var protoDescriptor = grpc.load({
    root: PROTO_ROOT_DIR,
    file: path.relative(PROTO_ROOT_DIR, googleProtoFiles.speech.v1beta1)
}, 'proto', {
    binaryAsBase64: true,
    convertFieldsToCamelCase: true
});
var speechProto = protoDescriptor.google.cloud.speech.v1beta1;
// [END proto]

// [START authenticating]
function getSpeechService() {

    return new Promise(function(resolve, reject) {

        var googleAuthClient = googleAuth({
            scopes: [
                'https://www.googleapis.com/auth/cloud-platform'
            ]
        });

        googleAuthClient.getAuthClient(function(err, authClient) {
            if (err) {
                logger.error('failed to get google authclient. Error:'+err);
                return reject(err);
            } else {


                var credentials = grpc.credentials.combineChannelCredentials(
                    grpc.credentials.createSsl(),
                    grpc.credentials.createFromGoogleCredential(authClient)
                );

                logger.debug('Loading speech service...');
                var stub = new speechProto.Speech(host, credentials);
                resolve(stub);
            }

        });

    });
}
// [END authenticating]



var GoogleSTT = function GoogleSTT() {

    logger.info('created google stt instance');

};
util.inherits(GoogleSTT, EventEmitter);

GoogleSTT.prototype.init = function(config, parentLogger) {

    logger = parentLogger.child({
        loc: 'GoogleSTT'
    });

    logger.info('dir:'+__dirname+", cred file path:"+ config.stt.google.googleCredentialFile);
    var credFile = config.stt.google.googleCredentialFile;

    process.env.GOOGLE_APPLICATION_CREDENTIALS = credFile;
    process.env.GCLOUD_PROJECT = config.stt.google.googleProjectName;


    // TODO : update model
    if (config.lang == 'cht' || config.lang == 'chs') {
        model = 'cmn-Hant-TW';
    } else if (config.lang == 'en') {
        model = 'en-US';
    }

    this.connect();

    logger.info('inited google stt. Model:', model);
};

GoogleSTT.prototype.write = function(data) {

    logger.debug('sending data to google, size'+data.length);

    if(!currentSession)
        logger.info('Google Session is not ready');

    writeStream.write(data);

};

GoogleSTT.prototype.connect = function() {

    logger.debug('connecting google speech service..');

    var self = this;

    getSpeechService().then(function(speechService) {

        logger.info('Connection Ready.');
        var session = speechService.streamingRecognize();
        currentSession = session;
        writeStream.pipe(session);

        session.on('data', function(recognizeResponse) {

            logger.debug('Received Response from google:'+JSON.stringify(recognizeResponse));


            if (recognizeResponse.results && recognizeResponse.results.length) {
                self.emit('msg', recognizeResponse.results[0].alternatives[0].transcript);
            }

        });

        session.on('end', function(err) {
            logger.error('session terminated.');
            writeStream.unpipe();
            currentSession.end();
            currentSession = null;
        });

        session.on('error', function(data) {
            logger.error('err catch ' + data);
            writeStream.unpipe();
            currentSession.end();
            currentSession = null;
        });


        // Write the initial recognize reqeust
        session.write({
            streamingConfig: {
                config: {
                    encoding: 'LINEAR16',
                    sampleRate: 16000,
                    languageCode: model
                },
                interimResults: false,
                singleUtterance: false
            }
        });

        writeStream.uncork();
    });

};

GoogleSTT.prototype.disconnect = function(){

    logger.info('disconnecting ... ');
    writeStream.unpipe();
    writeStream.pause();

    if(currentSession){

        currentSession.end();
        currendSession = null;
    }



};


GoogleSTT.prototype.reconnect = function(){

    logger.info('reconnecting ... ');
    writeStream.resume();
    writeStream.cork();
    if(!currentSession){
        this.connect();
    }

};


module.exports = GoogleSTT;
