app.controller('MainCtrl', function ($scope, $rootScope, $userSettings, TwitterApi, TWCryptoUtils, MessagesStore, FriendsStore) {
    $rootScope.messages = [];
    $rootScope.friends = [];
    $rootScope.unReadMessages = 0;

    $scope.$on('logged-out', function(event, args) {
        MessagesStore.clear();
        FriendsStore.clear();
        $rootScope.messages = [];
        $rootScope.unReadMessages = 0;
        $rootScope.updateProfile(null);
    });

    $rootScope.loadMessages = function () {
        $rootScope.messages = MessagesStore.find();
    };

    $rootScope.loadFriends = function () {
        $rootScope.friends = FriendsStore.find();
    };

    $rootScope.forceToastNotify = function (message, timeout) {
        var args = {force: true};
        if (timeout !== undefined) {
            args.timeout = timeout;
        }
        var toast = document.querySelector('ons-toast');
        toast && toast.remove();
        ons.notification.toast(message, args);
    };

    $rootScope.verifyTwitterAccount = function () {
        TwitterApi.setAuthConfig();
        $rootScope.forceToastNotify('Verifying Twitter api...');
        TwitterApi.verifyAccount(function (profile) {
            $rootScope.updateProfile(profile);
            if (!profile) {
                $rootScope.forceToastNotify('Error! Invalid Twitter Api!', 5000);
                return;
            }
            $rootScope.forceToastNotify('Success Login! Welcome "{0}"!'.f(profile.name), 5000);
            if (!TWCryptoUtils.extractPublicKeyUrlFromProfile($rootScope.profile.description)) {
                setTimeout($rootScope.uploadPublicKey, 1000);
            }
            $rootScope.$broadcast('logged-in', {profile: profile});
        }, function (res) {
            $rootScope.updateProfile(null);
            if(res.reply.httpstatus === 200) {
                $rootScope.forceToastNotify('Error! Invalid Twitter Api!', 5000);
            } else {
                $rootScope.forceToastNotify(TwitterApi.extractError(res.reply), 3000);
            }
        });
    };

    $rootScope.uploadPublicKey = function () {
        TwitterApi.setAuthConfig();
        var encPubKey = TWCryptoUtils.makePublicKeyLongUrl($userSettings.get('public_key'));
        $rootScope.forceToastNotify('Uploading public key on your profile ...');
        var showFailedUploadMessage = function (res) {
            $rootScope.forceToastNotify(TwitterApi.extractError(res.reply), 3000);
        };
        TwitterApi.call('statuses_update', {'status': encPubKey}, function (res) {
            var shortenUrl = res.reply.text,
                pubPayload = TWCryptoUtils.formatPublicKey(shortenUrl),
                newProfileDesc = TWCryptoUtils.makeInjectedPublicKeyProfile($rootScope.profile.description, pubPayload);
            TwitterApi.call('statuses_destroy_ID', {'id': res.reply.id_str});
            TwitterApi.call('account_updateProfile', {'description': newProfileDesc}, function (res2) {
                $rootScope.forceToastNotify('Success! public key uploaded.', 3000);
                $rootScope.updateProfile(res2.reply);
            }, showFailedUploadMessage);
        }, showFailedUploadMessage);
    };

    $scope.openMenu = function () {
        var menu = document.getElementById('sidemenu');
        menu.open();
    };

    $scope.loadPage = function (page) {
        var menu = document.getElementById('sidemenu');
        menu.close();
        $scope.navi.resetToPage(page, {animation: 'fade'});
    };

    $scope.pushPage = function (page, params, event) {
        var menu = document.getElementById('sidemenu');
        menu.close();
        $scope.navi.pushPage(page, params, event);
    };

    $rootScope.loadProfile = function () {
        $rootScope.profile = $userSettings.get('twitter_profile') || {};
    };

    $rootScope.updateProfile = function (profile) {
        $userSettings.set('twitter_profile', profile);
        $rootScope.loadProfile();
        $rootScope.$apply();
    };

    $scope.login = function () {
        var keys = ['twitter_consumer_key', 'twitter_consumer_secret', 'twitter_access_token_key',
            'twitter_access_token_secret'];
        notCompleteSettings = false;
        for(var i = 0; i < keys.length; i++) {
            if (!$userSettings.get(keys[i])) {
                notCompleteSettings = true;
                break;
            }
        }
        if (notCompleteSettings) {
            $rootScope.forceToastNotify('Please configure your twitter api!', 5000);
            $scope.pushPage('app/html/pages/settings.html');
        } else {
            $rootScope.verifyTwitterAccount();
        }
    };

    $scope.logout = function () {
        ons.notification.confirm({
                title: 'Logout?',
                message: 'Are you want to logout?',
                buttonLabels: ['Cancel', 'Yes']
        }).then(function (buttonIndex) {
            if (buttonIndex === 1) {
                // If 'Save' button was pressed, save settings
                TwitterApi.logout();
                $rootScope.$broadcast('logged-out', {profile: $rootScope.profile})
            }
        });
    };

    $rootScope.loadProfile();
});

app.controller('SettingsCtrl', function ($scope, $rootScope, $userSettings, TWCryptoUtils) {
    $scope.settings = {};

    $scope.loadSettings = function () {
        var settingKeys = [
            'private_key', 'public_key', 'twitter_consumer_key', 'twitter_consumer_secret',
            'twitter_access_token_key', 'twitter_access_token_secret', 'twitter_use_proxy'];
        settingKeys.forEach(function (key) {
            $scope.settings[key] = $userSettings.get(key);
        });
    };

    $scope.validateKeysBeforeSave = function () {
        var public_key = $scope.settings.public_key,
            private_key = $scope.settings.private_key;
        if (public_key && !TWCryptoUtils.validateRsaKey(public_key, 'public')) {
            ons.notification.alert('Please enter a valid rsa public key!');
            return false;
        }
        if (private_key && !TWCryptoUtils.validateRsaKey(private_key, 'private')) {
            ons.notification.alert('Please enter a valid rsa private key!');
            return false;
        }
        return true;
    };

    $scope.openConfirmSave = function() {
        if (!$scope.validateKeysBeforeSave()) {
            return;
        }
        ons.notification.confirm({
                title: 'Save changes?',
                message: 'Previous data will be overwritten.',
                buttonLabels: ['Discard', 'Save']
        }).then(function (buttonIndex) {
            if (buttonIndex === 1) {
                // If 'Save' button was pressed, save settings
                $scope.saveSettings();
                $scope.navi.popPage();
            }
        });
    };

    $scope.saveSettings = function () {
        var needsVerifyAccount = false;
        if (!$rootScope.profile.name) {
            needsVerifyAccount = true;
        } else {
            var keys = ['twitter_consumer_key', 'twitter_consumer_secret', 'twitter_access_token_key',
            'twitter_access_token_secret'];
            for(var i = 0; i < keys.length; i++) {
                if (($scope.settings[keys[i]] !== $userSettings.get(keys[i]))) {
                    needsVerifyAccount = true;
                    break;
                }
            }
        }
        angular.forEach($scope.settings, function(value, key) {
            $userSettings.set(key, value);
        });
        if (needsVerifyAccount) {
            $rootScope.verifyTwitterAccount();
        }
    };

    $scope.generateNewRsaKeys = function() {
        var keys = TWCryptoUtils.generateKeyPair();
        $scope.settings.public_key = keys.public;
        $scope.settings.private_key = keys.private;
    };

    $scope.onUploadPublicKeyClick = function () {
        if (!$scope.validateKeysBeforeSave()) {
            return;
        }
        if (!$rootScope.profile.name) {
            $rootScope.forceToastNotify('Error! You are not login! Please login first.', 3000);
            return;
        }
        var confirmMsg = 'This will modify your profile description to add public key. Are you agree?';
        if (TWCryptoUtils.extractPublicKeyUrlFromProfile($rootScope.profile.description)) {
            confirmMsg = 'Seems already a public key was uploaded. Are you want to overwrite previous?'
        }
        ons.notification.confirm({
                title: 'Upload Public Key?',
                message: confirmMsg,
                buttonLabels: ['Cancel', 'Yes']
        }).then(function (buttonIndex) {
            if (buttonIndex === 1) {
                // If 'Yes' button was pressed, save settings
                $userSettings.set('public_key', $scope.settings.public_key);
                $userSettings.set('private_key', $scope.settings.private_key);
                $rootScope.uploadPublicKey();
            }
        });
    };
    $scope.loadSettings();
});

app.controller('MessagesListCtrl', function ($scope, $rootScope, $timeout, $userSettings, TwitterApi, TWCryptoUtils, MessagesStore) {
    $rootScope.unReadMessages = MessagesStore.reCalcUnreadMessagesCount();
    $scope.refreshing = false;

    $scope.$on('logged-in', function(event, args) {
        $scope.refreshMessages(undefined, true);
        $rootScope.unReadMessages = MessagesStore.reCalcUnreadMessagesCount();
    });

    $scope.messagesPullRefreshLoad = function ($done) {
        $timeout(function () {
            $scope.refreshMessages($done);
        }, 10);
    };

    $scope.refreshMessages = function (finishedCallback, direct) {
        if (direct) {
            $scope.refreshing = true;
        }
        TwitterApi.setAuthConfig();
        var privateKey = $userSettings.get('private_key');
        if (!privateKey) {
            $scope.refreshing = false;
            finishedCallback && finishedCallback();
            return;
        }
        TwitterApi.getAllHomeTimeline(function (res) {
            var maxId = res.max_id;
            (res.records || []).forEach(function (record) {
                var longUrl = record.entities.urls[0] && record.entities.urls[0].expanded_url;
                try {
                    var decryptedMessage = TWCryptoUtils.decryptMessage(longUrl, privateKey),
                        user = {id: record.user.id_str, screen_name: record.user.screen_name, name: record.user.name,
                               profile_image_url: record.user.profile_image_url},
                        created_at = moment(new Date(record.created_at)).utc().format();
                    MessagesStore.insert({id: record.id_str, message: decryptedMessage, user: user, created_at: created_at});
                    MessagesStore.incUnreadMessagesCount();
                    $rootScope.unReadMessages += 1;
                } catch (e) {}
            });
            if (maxId) {
                MessagesStore.setLastMessageId(maxId);
            }
            $rootScope.loadMessages();
            $scope.refreshing = false;
            $rootScope.$apply();
            finishedCallback && finishedCallback();

        }, function (res) {
            $scope.refreshing = false;
            finishedCallback && finishedCallback();
            $rootScope.forceToastNotify(TwitterApi.extractError(res.reply), 5000);
        }, "\\|EnCt\\| https:\\/\\/t\\.co\\/[0-9a-zA-Z]{1,10}\\|$", undefined, MessagesStore.getLastMessageId());
    };
    $rootScope.loadMessages();
    if ($rootScope.profile.id) {
        $scope.refreshMessages(undefined, true);
    }
});

app.controller('ChooseRecipientCtrl', function ($scope, $rootScope, $userSettings, TwitterApi, TWCryptoUtils) {
});

app.controller('NewMessageCtrl', function ($scope, $rootScope, $userSettings, TwitterApi, TWCryptoUtils) {
    $scope.newMessage = {to: $scope.navi.topPage.data.recipient};
    $scope.disabledSend = function () {
        return !$scope.newMessage.message || !$scope.newMessage.message.trim();
    };
    $scope.sendMessage = function () {
        TwitterApi.setAuthConfig();
        $rootScope.forceToastNotify('Sending message to "{0}"...'.format($scope.newMessage.to.name));
        var publicKey = TWCryptoUtils.extractPublicKeyFromUrl($scope.newMessage.to.public_key_url);
        try {
            var encryptedMessage = TWCryptoUtils.encryptMessage($scope.newMessage.message, publicKey);
        } catch (e) {
            $rootScope.forceToastNotify('Invalid public key for user "{0}"'.format($scope.newMessage.to.name), 2000);
            return;
        }
        TwitterApi.call('statuses_update', {status: encryptedMessage}, function(res) {
            $rootScope.forceToastNotify('Message Sent to "{0}" successfully!'.format($scope.newMessage.to.name), 2000);
            $scope.navi.popPage();
        }, function(res) {
            $rootScope.forceToastNotify(TwitterApi.extractError(res.reply), 2000);
        });
    }
});

app.controller('ViewMessageCtrl', function ($scope, $rootScope, $userSettings, TwitterApi, TWCryptoUtils, MessagesStore) {
    $scope.message = $scope.navi.topPage.data.message;
    if (!$scope.message.read) {
        MessagesStore.markAsRead($scope.message.id);
        $rootScope.loadMessages();
        $rootScope.unReadMessages -= 1;
    }
});

app.controller('FriendsListCtrl', function ($scope, $rootScope, $timeout, $userSettings, TwitterApi, TWCryptoUtils, FriendsStore) {
    $scope.refreshing = false;
    $scope.$on('logged-in', function(event, args) {
        $scope.refreshFriends(undefined, true);
    });

    $scope.onSelectItem = function (recipient, event) {
        if (recipient.joined) {
            $scope.navi.pushPage('app/html/pages/new_message.html', {data: {recipient: recipient}}, event);
        } else {
            ons.notification.confirm({
                    title: 'Invite?',
                    message: 'Send invitation message to "{0}"?'.format(recipient.name),
                    buttonLabels: ['Cancel', 'Yes']
            }).then(function (buttonIndex) {
                if (buttonIndex === 1) {
                    $rootScope.forceToastNotify('"{0}" invited successfully!'.format(recipient.name), 3000);
                }
            });
        }
    };

    $scope.friendsPullRefreshLoad = function ($done) {
        $timeout(function () {
            $scope.refreshFriends($done);
        }, 10);
    };

    $scope.refreshFriends = function (finishedCallback, direct) {
        if (direct) {
            $scope.refreshing = true;
        }
        TwitterApi.setAuthConfig();
        var privateKey = $userSettings.get('private_key');
        if (!privateKey) {
            $scope.refreshing = false;
            finishedCallback && finishedCallback();
            return;
        }
        TwitterApi.getAllFollowers(function (users) {
            FriendsStore.clear();
            users.forEach(function (u) {
                var shortUrl = TWCryptoUtils.extractPublicKeyUrlFromProfile(u.description),
                    public_key_url = null;
                if (shortUrl) {
                    public_key_url = u.entities.description.urls.find(function (u) {
                        return u.url === shortUrl;
                    });
                    if (public_key_url) {
                        public_key_url = public_key_url.expanded_url;
                    }
                }
                var joined = !!public_key_url;
                FriendsStore.insert({id: u.id_str, name: u.name, screen_name: u.screen_name, created_at: u.created_at,
                                     profile_image_url: u.profile_image_url, public_key_url: public_key_url, joined: joined});
            });
            $rootScope.loadFriends();
            $scope.refreshing = false;
            $rootScope.$apply();
            finishedCallback && finishedCallback();
        }, function (res) {
            $scope.refreshing = false;
            finishedCallback && finishedCallback();
            $rootScope.forceToastNotify(TwitterApi.extractError(res.reply), 5000);
        });
    };
    $rootScope.loadFriends();
    if ($rootScope.profile.id) {
        $scope.refreshFriends(undefined, true);
    }
});
