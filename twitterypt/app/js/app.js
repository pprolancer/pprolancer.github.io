var app = angular.module('twitterypt', ['onsen', 'angularUserSettings']);

app.directive('errSrc', function () {
    return {
        link: function (scope, element, attrs) {
            var watcher = scope.$watch(function () {
                return attrs['ngSrc'];
            }, function (value) {
                if (!value) {
                    element.attr('src', attrs.errSrc);
                }
            });
            element.bind('error', function () {
                element.attr('src', attrs.errSrc);
            });
            //unsubscribe on success
            element.bind('load', watcher);
        }
    }
});
