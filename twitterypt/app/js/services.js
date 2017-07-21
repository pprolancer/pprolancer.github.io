var RSA_BITS_SIZE = 1024;
var LONG_BASE_URL = 'http://mock.co/';
var TWITTERYPT_PREFIX = '|EnCt|';
var PUBLIC_KEY_BEGIN = '-----BEGIN PUBLIC KEY-----';
var PUBLIC_KEY_END = '-----END PUBLIC KEY-----';


String.prototype.format = String.prototype.f = function() {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};

function getParameterByName(name, url) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function getRedicrecedUrl(url, callback) {
    //getRedicrecedUrl('https://goo.gl/dpRLxj')
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function (data) {
        if (xhr.status === 200 && xhr.readyState === 4) {
            return callback && callback(xhr.responseURL);
        }
    };
    xhr.open('HEAD', url, true);
    xhr.send();
}

app.service('TWCryptoUtils', [function() {
    this.generateKeyPair = function (size) {
        size = size || RSA_BITS_SIZE;
        var rsa =  new NodeRSA({b: size});
        return {public: rsa.exportKey('public'), private: rsa.exportKey('private')}
    };

    this.validateRsaKey = function (rsa_key, key_type) {
        var key = new NodeRSA();
        try {
            key.importKey(rsa_key, key_type || 'public');
        } catch(e) {
            return false;
        }
        return true;
    };

    this.extractPublicKeyUrlFromProfile = function (profileDesc) {
        var regex = new RegExp("\\|EnCt\\| https:\\/\\/t\\.co\\/[0-9a-zA-Z]{1,10}\\|$"),
            url = null;
        profileDesc.replace(regex, function(u) {
            url = u;
        });
        if (url) {
            url = url.replace(TWITTERYPT_PREFIX, '').replace('|', '').trim();
        }
        return url;
    };

    this.makePublicKeyLongUrl = function (public_key, base_url) {
        base_url = base_url || LONG_BASE_URL;
        key = public_key.split('\n').filter(function(i) {
            return !i.startsWith('-----');
        }).join('\n');
        args = $.param({'key': key});
        return '{0}?{1}'.format(base_url, args);

    };

    this.rsaEncrypt = function (message, public_key) {
        var key = new NodeRSA();
        key.importKey(public_key, 'public');
        return key.encrypt(message, 'base64')
    };

    this.rsaDecrypt = function (message, private_key) {
        var key = new NodeRSA();
        key.importKey(private_key, 'private');
        return key.decrypt(message, 'utf8')
    };

    this.makeEncryptedMessageLongUrl = function (message, public_key, base_url) {
        base_url = base_url || LONG_BASE_URL;
        var enc_data = this.rsaEncrypt(message, public_key);
        var args = $.param({'data': enc_data});
        return '{0}?{1}'.format(base_url, args);
    };

    this.formatPublicKey = function (short_url, prefix) {
        prefix = prefix || TWITTERYPT_PREFIX;
        return '{0} {1}|'.format(prefix, short_url);
    };

    this.makeInjectedPublicKeyProfile = function (profileDesc, publicKeyData) {
        var maxLen = 160;
        twitteryptPrefixIdx = profileDesc.indexOf(TWITTERYPT_PREFIX);
        if (twitteryptPrefixIdx >= 0) {
            profileDesc = profileDesc.slice(0, twitteryptPrefixIdx);
        }
        return '{0} {1}'.format(profileDesc.slice(0, maxLen - publicKeyData.length - 1), publicKeyData);
    };

    this.extractEncryptedMessageFromUrl = function (url, arg_name) {
        arg_name = arg_name || "data";
        return getParameterByName(arg_name, url);
    };

    this.extractPublicKeyFromUrl = function (url, arg_name) {
        arg_name = arg_name || 'key';
        var key = getParameterByName(arg_name, url);
        return '{0}\n{1}\n{2}'.format(PUBLIC_KEY_BEGIN, key, PUBLIC_KEY_END);
    };

    this.decryptMessage = function (longUrl, private_key, prefix) {
        enc_data = this.extractEncryptedMessageFromUrl(longUrl);
        return this.rsaDecrypt(enc_data, private_key);
    };

    this.encryptMessage = function (message, public_key, prefix, base_url) {
        prefix = prefix || TWITTERYPT_PREFIX;
        base_url = base_url || LONG_BASE_URL;
        var url = this.makeEncryptedMessageLongUrl(message, public_key, base_url);
        return "{0} {1}|".format(prefix, url);
    };

}]);

app.service('TwitterApi', ['$userSettings', function($userSettings) {
    // TwitterApi=angular.element(document.body).injector().get('TwitterApi')

    this.cb = new Codebird;

    this.setUseProxy = function (useProxy) {
        this.cb.setUseProxy((useProxy === true));
    };

    this.setAuthConfig = function (consumerKey, consumerSecret, accessTokenKey, accessTokenSecret, useProxy) {
        consumerKey = consumerKey || $userSettings.get('twitter_consumer_key');
        consumerSecret = consumerSecret || $userSettings.get('twitter_consumer_secret');
        accessTokenKey = accessTokenKey || $userSettings.get('twitter_access_token_key');
        accessTokenSecret = accessTokenSecret || $userSettings.get('twitter_access_token_secret');
        useProxy = (useProxy === undefined? $userSettings.get('twitter_use_proxy'): useProxy);
        this.cb.setConsumerKey(consumerKey, consumerSecret);
        this.cb.setToken(accessTokenKey, accessTokenSecret);
        this.setUseProxy(useProxy);
    };

    this.logout = function () {
        this.cb.logout();
    };

    this.verifyAccount = function (callback, errCallback) {
        this.call("account_verifyCredentials", {}, function (data) {
            var account = data.reply.errors? null: data.reply;
            return callback && callback(account);
        }, function (res) {
            errCallback && errCallback(res);
        });
    };

    this.getAllHomeTimeline = function(callback, errCallback, filterRegex, maxId, sinceId, res) {
        // getAllHomeTimeline(function(res) {}, '^\\|EnCt\\|')

        console.log(maxId);
        if(maxId === 0) {
            return callback && callback(res);
        }
        res = (res === undefined? {records: []}: res);
        var params = {exclude_replies: true, include_entities: true, count: 200};
        if (maxId) {
            params.max_id = maxId;
        }
        if (sinceId) {
            params.since_id = sinceId;
        }
        var self = this;
        this.call("statuses_homeTimeline", params, function(data) {
            var count = data.reply.length;
            var nextMaxId = count?bigInt(data.reply[count - 1].id_str).subtract(1).toString(): 0;
            var newData = data.reply;
            if(filterRegex) {
                newData = data.reply.filter(function (r) {
                    return r.text.search(filterRegex) >= 0;
                });
            }
            res.records.push.apply(res.records, newData);
            if (res.max_id === undefined) {
                res.max_id = (data.reply.length > 0? data.reply[0].id_str: 0)
            }
            return self.getAllHomeTimeline(callback, errCallback, filterRegex, nextMaxId, sinceId, res);
        }, errCallback);
    };

    this.getAllFollowers = function(callback, errCallback, cursor, res) {

        if(cursor === "0") {
            return callback && callback(res);
        }
        res = (res === undefined? []: res);
        var params = {skip_status: true, count: 200};
        if (cursor) {
            params.cursor = cursor;
        }
        var self = this;
        this.call("followers_list", params, function(data) {
            var newData = data.reply.users;
            res.push.apply(res, newData);
            return self.getAllFollowers(callback, errCallback, data.reply.next_cursor_str, res);
        }, errCallback);
    };

    this.call = function (func, args, callback, errCallback) {
        this.cb.__call(func, args || {}).then(function(res) {
            if (res.reply && res.reply.errors && res.reply.errors.length > 0) {
                return errCallback && errCallback(res);
            }
            if (res.reply.httpstatus !== 200) {
                return errCallback && errCallback(res);
            }
            return callback && callback(res);
        }, errCallback);
    };

    this.extractError = function (reply) {
        if (reply.httpstatus === 429) {
            return 'Rate limit exeeded for this twitter operation! please try later!';
        }
        if (reply.httpstatus === 0) {
            return 'Network connection error! Check your internet connection!';
        }
        var msg = (reply.errors || []).map(function(r) {
            return r.message;
        }).join(' | ');
        return msg || 'Unknown Error raised!';
    }
}]);


app.service('MessagesStore', ['$userSettings', function($userSettings) {
    this.store = depot('messages', {idAttribute: 'id'});
    this.insert = function (record) {
        this.store.save(record);
    };

    this.remove = function (id) {
        this.store.destroy(id);
    };

    this.get = function (id) {
        return this.store.get(id);
    };

    this.find = function (conditionsOrFunc) {
        return this.store.find(conditionsOrFunc);
    };

    this.destroyAll = function (conditions) {
        if (conditions) {
            return this.store.destroyAll(conditions);
        }
        return this.store.destroyAll();
    };

    this.clear = function () {
        ['messages__unread_messages_count', 'messages__last_id'].forEach(function (k) {
            $userSettings.set(k, null);
        });
        this.destroyAll();
    };

    this.markAsRead = function (id) {
        this.store.update(id, {'read': true});
    };

    this.setLastMessageId = function (maxId) {
        $userSettings.set('messages__last_id', maxId);
    };

    this.getLastMessageId = function () {
        return $userSettings.get('messages__last_id');
    };

    this.getUnreadMessagesCount = function () {
        return $userSettings.get('messages__unread_messages_count') || 0;
    };

    this.incUnreadMessagesCount = function (n) {
        if (n === undefined) {
            n = 1;
        }
        n += ($userSettings.get('messages__unread_messages_count') || 0);
        if (n < 0) {
            n = 0;
        }
        $userSettings.set('messages__unread_messages_count', n);
    };

    this.reCalcUnreadMessagesCount = function () {
        var count = this.store.find(function (record) {
            return !record.read;
        }).length;
        $userSettings.set('messages__unread_messages_count', count);
        return count;
    };


}]);

app.service('FriendsStore', ['$userSettings', function($userSettings) {
    this.store = depot('friends', {idAttribute: 'id'});
    this.insert = function (record) {
        this.store.save(record);
    };

    this.remove = function (id) {
        this.store.destroy(id);
    };

    this.get = function (id) {
        return this.store.get(id);
    };

    this.find = function (conditionsOrFunc) {
        return this.store.find(conditionsOrFunc);
    };

    this.destroyAll = function (conditions) {
        if (conditions) {
            return this.store.destroyAll(conditions);
        }
        return this.store.destroyAll();
    };

    this.clear = function () {
        this.destroyAll();
    };

}]);
