// Source: dist/.temp/filters/default/default.js
app.filter('default', function () {
    return function (input, value) {
        if (input !== null && input !== undefined && input !== '') {
            return input;
        }
        return value || '';
    };
});

app.filter('findById', function () {
    return function (input, value) {
        if(input) {
              for (var i=0; i<input.length; i++) {
                  if (input[i].id == value) {
                      return input[i];
                  }
              }

        }
    };
});

app.filter('displayObject', function () {
    return function (input, fields) {
        if(input) {
            var s = [];
            fields = fields.split(',');
            fields.forEach(function (f) {
                s.push(input[f]);
            });
            if(s.length === 1) {
                return s[0]
            }
            return s.join(' ');
        }
    };
});

app.filter('orderObjectBy', function() {
    return function(items, field, reverse) {
        var filtered = [];
        angular.forEach(items, function(item) {
            filtered.push(item);
        });
        filtered.sort(function (a, b) {
            return (a[field] > b[field] ? 1 : -1);
        });
        if(reverse) filtered.reverse();
        return filtered;
    };
});

app.filter('sumByKey', function() {
    return function(items, prop) {
        if (typeof(items) === 'undefined' || typeof(prop) === 'undefined') {
            return 0;
        }
        return items.reduce( function(a, b) {
            return a + (b[prop]||0);
        }, 0);
    };
});

app.filter('humanizeDate', function() {
    return function(dt) {
        if (!dt) {
            return;
        }
        dt = moment(dt);
        var now = moment().utc(),
            format;
        if (now.year() === dt.year() && now.month() === dt.month() && now.date() === dt.date()) {
            format = 'h:mm a';
        } else if (now.year() === dt.year()) {
            format = 'MMM DD';
        } else {
            format = 'MMM D YYYY';
        }
        return dt.format(format)
    };
});

app.filter('humanizeFullDate', function() {
    return function(dt) {
        if (!dt) {
            return;
        }
        dt = moment(dt);
        var format = 'MMM D YYYY h:mm a';
        return dt.format(format)
    };
});

app.filter('profileImageOrig', function() {
    return function(imageUrl) {
        if (!imageUrl) {
            return;
        }
        return imageUrl.replace('_normal', '');
    };
});
