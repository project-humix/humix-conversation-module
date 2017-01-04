## Overview

This humix modules is essentially a wrapper to a few STT and TTS engines. The goal is to simplify the effort required to use STT/TTS technologies so that the higher level component (e.g. Humix-Think) can easily receive the recognized text and issue text to be sythesized. As an analogy, this module gives the ear and mouth to a robot, or cognitive device in general.

# Get Started

## Download and install dependencies

        git clone https://github.com/project-humix/humix-conversation-module.git
        cd humix-conversation-module
        npm install


## Config module

**Option1 : modify config.js**

Basically, you need to configure three information

1. what language to use
2. what stt/tts engine to use
3. what is the credential for these tts engine

For language, currently supported options are:

* `en` (English)
* `cht` (Traditional Chinese)
* `chs` (Simplified Chinese).


For stt engine, currently supported engines are
* `google` (en/cht)
* `watson` (en/cht/chs)

For tts engine, currently supported engines are
* `watson` (en)
* `ITRI` (en/cht) . for more inforamtion about ITRI, please check [here](http://tts.itri.org.tw/)

Once you specified the language and engine to use, the next step is to apply the crednetial of these engines.

* for watson stt/tts services, you can apply at `bluemix`
* for google speech API, please apply [here](https://console.cloud.google.com)
   * create new project and keep the project name
   * API Management -> Credientials -> Create Credentials -> Service account key
   * Select "Compute Engine default service account. Select JSON as output format. Click create
   * Go back to API Management Dashboard, make sure 'Google Cloud Speech API' is enabled
* for ITRI tts, you can apply id/pass [here](http://tts.itri.org.tw/)
    * You can also specify the speaker (e.g. Bluce, Angela)


**Option2 : use global humix config file (*recommended*)**

You can also provide the config of this module using the global humix config file, which is located at `~/.humix/config.js`
The content is the same as option1, but now you move these config under the "humix-conversation-module" properties. Example config looks like
```
module.exports = {

    sense:{
         thinkURL : 'http://127.0.0.1:3000',
         senseId  : 'robot1'
    },
    'humix-conversation-module':{

        lang: 'cht', // 'en', 'cht' or 'chs'
        'stt-engine': 'google', // 'watson' or 'google',
        'tts-engine': 'itri', // 'watson' or 'itri' or 'iflytek'
        stt: {
            watson: {
                username: '',
                passwd: ''
            },
            google: {
                username: '',
                passwd: '',
                googleCredentialFile: '', //the location of your google auth credential file. Absolute path
                googleProjectName: '', //the project name which create your credential file.
                googleLan: 'en-Us', // en-Us or cmn-Hant-TW
            }
        },
        tts: {
            watson: {
                username: '',
                passwd: ''
            },
            iflytek: {
                appid: '<app_id>'
            },
            itri: {
                username: '',
                passwd: '',
                speaker: 'Angela',
            }
        }
    },
}
```

## Start module

        npm start