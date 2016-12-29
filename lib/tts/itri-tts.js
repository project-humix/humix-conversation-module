// Watson TTS Processing

var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var wav = require('wav');
var soap = require('soap');
var execSync = require('child_process').execSync;


var ttsEngine;
var logger;

var username;
var password;
var speaker;

var url = 'http://tts.itri.org.tw/TTSService/Soap_1_3.php?wsdl';
var retry = 0;

function synthesizeText(text, callback) {

  logger.debug('ready to synthesize text:' + text);
  var args = {
    accountID : username,
    password : password,
    TTStext : text,
    TTSSpeaker : speaker,
    volume : 50,
    speed : -2,
    outType : 'wav'
  };
  soap.createClient(url, function(err, client) {
    client.ConvertText(args, function(err, result) {
      if (err) {
        logger.error('err:', err);
        callback(err, null);
      }

      logger.debug('get result:'+result);
      try {
        var id = result.Result.$value.split('&')[2];
        if (id) {
          logger.debug('get id:', id);
          callback(null, id);
        } else {
          throw 'failed to convert text!';
        }
      } catch (e) {
        logger.error(e);
        callback(e, null);
      }
    });
  });
}

function ItriGetConvertStatus(id, filename, callback) {
  var args = {
    //accountIDhasOwnProperty: config.tts.itri.username,
    accountID : username,
    password : password,
    convertID : id
  };
  soap.createClient(url, function(err, client) {
    logger.debug('msg_id', id);
    client.GetConvertStatus(args, function(err, result) {
      if (err) {
        logger.error('err:', err);
        callback(err, null);
      }
      var downloadUrl = result.Result.$value.split('&')[4];
      if (downloadUrl) {

        logger.debug(id, downloadUrl);
        execSync('wget ' + downloadUrl + ' -O ' + filename, {
          stdio : [ 'ignore', 'ignore', 'ignore' ]
        });
        callback(null, filename);
      } else {
        var error = 'Still converting! result: ' + JSON.stringify(result);
        logger.error(error);
        callback(error, null);
      }
    });
  });
}

function ItriDownload(id, filename, resolve) {

  logger.debug('download id:'+id);
  retry++;
  ItriGetConvertStatus(id, filename, function(err) {
    if (err) {
      logger.error('err:', err);
      if (retry < 10) {
        logger.debug('retry', retry);
        setTimeout(ItriDownload, 2000, id, filename, resolve);
      }
    } else {
      logger.debug('Download id:' + id + ' completed. Save to file:', filename);

      resolve();
    }
  });
}



var ItriTTS = {

    init: function(config,parentLogger) {

        logger = parentLogger.child({loc: 'ItriTTS'});
        logger.info('init itri tts');

        username = config.tts.itri.username;
        password = config.tts.itri.passwd;
        speaker  = config.tts.itri.speaker;
    },

    tts: function(text, filename) {
        logger.debug('tts() : text:' ,text, ' filename:', filename);

        return new Promise(function(resolve, reject) {

            synthesizeText(text, function(err, id) {
                if (err) {
                    logger.error('failed to download wav from ITRI. Error:', err);
                } else {
                    logger.debug('got id:' + id);
                    retry = 0;
                    setTimeout(ItriDownload, 1000, id, filename, resolve);
                }
            });

        });

    }


}

module.exports = ItriTTS;
