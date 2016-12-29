'use strict';

var async = require('async');
var fs = require('fs');
var config = require("../../config.js");
var path = require('path');
var grpc = require('grpc');
var googleProtoFiles = require('google-proto-files');
var googleAuth = require('google-auto-auth');
var EventEmitter = require('events').EventEmitter;
var event = new EventEmitter();
var Transform = require('stream').Transform;
var process = require("process");
// [START proto]

var PROTO_ROOT_DIR = googleProtoFiles('..');

console.log('root dir:'+ PROTO_ROOT_DIR);
var the_stream = new Transform({
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
function getSpeechService(host, callback) {
    var googleAuthClient = googleAuth({
        scopes: [
            'https://www.googleapis.com/auth/cloud-platform'
        ]
    });

    googleAuthClient.getAuthClient(function(err, authClient) {
        if (err) {
            return callback(err);
        }

        var credentials = grpc.credentials.combineChannelCredentials(
            grpc.credentials.createSsl(),
            grpc.credentials.createFromGoogleCredential(authClient)
        );

        console.log('Loading speech service...');
        var stub = new speechProto.Speech(host, credentials);
        return callback(null, stub);
    });
}
// [END authenticating]

exports.startSession = function(username, passwd, model, callback) {
    if (model instanceof Function) {
        callback = model;
    }
    //var rStream;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = config.stt.google.googleCredentialFile;
    process.env.GCLOUD_PROJECT = config.stt.google.googleProjectName;
    waterFall(callback);

    console.log('the stream is ' + the_stream);
    return the_stream;



}

function waterFall(callback) {

    async.waterfall([
            function(cb) {
                getSpeechService('speech.googleapis.com', cb);
            }
        ],
        // [START send_request]
        function sendRequest(err, speechService) {
            console.log('Analyzing speech...');
            var responses = [];
            var call = speechService.streamingRecognize();
            the_stream.pipe(call);
            console.log('start to sent to google');
            //event.emit('connect',call);
            // Listen for various responses
            //call.on('error', cb);
            call.on('data', function(recognizeResponse) {

                console.log('google recive data');
                if (recognizeResponse) {
                    responses.push(recognizeResponse);
                    if (recognizeResponse.results && recognizeResponse.results.length) {
                        console.log(JSON.stringify(recognizeResponse.results, null, 2));
                        callback(recognizeResponse.results[0].alternatives[0].transcript);
                    }
                }
            });
            call.on('end', function() {
                console.log('服務終止  重新連線');
                the_stream.unpipe(call);
                waterFall(callback);
            });
            call.on('error', function(data) {
                console.log('err catch ' + data);
                the_stream.unpipe(call);
                waterFall(callback);

            });


            // Write the initial recognize reqeust
            call.write({
                streamingConfig: {
                    config: {
                        encoding: 'LINEAR16',
                        sampleRate: 16000,
                        languageCode: config.stt.google.googleLan
                    },
                    interimResults: false,
                    singleUtterance: false
                }
            });



        }
    );


}