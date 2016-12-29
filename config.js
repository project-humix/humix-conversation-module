module.exports = {

    lang: 'cht', // 'en', 'cht' or 'chs'
    'stt-engine': 'google', // 'watson' or 'google',
    'tts-engine': 'itri', // 'watson' or 'itri' or 'iflytek'
    stt: {
        watson: {
            username: '',
            passwd: ''
        },
        google: {
            username: 'xxxxx',
            passwd: '',
            googleCredentialFile: '', //the location of your google auth credential file.
            googleProjectName: '', //the project name which create your credential file.
            googleLan: 'cmn-Hant-TW', // en-Us or cmn-Hant-TW
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
            speaker: '',
        }
    }
};
