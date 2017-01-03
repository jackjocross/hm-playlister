#! /usr/bin/env node
'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _isomorphicFetch = require('isomorphic-fetch');

var _isomorphicFetch2 = _interopRequireDefault(_isomorphicFetch);

var _secrets = require('../secrets.json');

var _secrets2 = _interopRequireDefault(_secrets);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var client_id = _secrets2.default.client_id,
    client_secret = _secrets2.default.client_secret,
    refresh_token = _secrets2.default.refresh_token;
var access_token = _secrets2.default.access_token;


var playlist_name = 'Hypem Weekly';

var authOptions = {
  url: 'https://accounts.spotify.com/api/token',
  headers: { 'Authorization': 'Basic ' + new Buffer(client_id + ':' + client_secret).toString('base64') },
  form: {
    grant_type: 'refresh_token',
    refresh_token: refresh_token
  },
  json: true
};

_request2.default.post(authOptions, function (error, response, body) {
  access_token = body.access_token;

  var options = {
    headers: { 'Authorization': 'Bearer ' + access_token }
  };

  var profilePending = (0, _isomorphicFetch2.default)('https://api.spotify.com/v1/me', options);
  var playlistsPending = (0, _isomorphicFetch2.default)('https://api.spotify.com/v1/me/playlists', options);

  Promise.all([profilePending, playlistsPending]).then(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2),
        profileReq = _ref2[0],
        playlistsReq = _ref2[1];

    Promise.all([profileReq.json(), playlistsReq.json()]).then(function (_ref3) {
      var _ref4 = _slicedToArray(_ref3, 2),
          profile = _ref4[0],
          playlists = _ref4[1];

      var playlist = playlists.items.filter(function (item) {
        return item.name === playlist_name;
      })[0];
      if (playlist) {
        (0, _isomorphicFetch2.default)('https://api.spotify.com/v1/users/' + profile.id + '/playlists/' + playlist.id + '/tracks', Object.assign({}, options, { method: 'PUT' })).then(function () {
          return populate(playlist, profile, options);
        });
      } else {
        var createOpts = Object.assign({}, options, {
          method: 'POST',
          body: JSON.stringify({
            name: playlist_name
          })
        });
        (0, _isomorphicFetch2.default)('https://api.spotify.com/v1/users/' + profile.id + '/playlists', createOpts).then(function (response) {
          return response.json();
        }).then(function (newPlaylist) {
          populate(newPlayist, profile, options);
        });
      }
    });
  });
});

function populate(playlist, profile, options) {
  (0, _isomorphicFetch2.default)('https://api.hypem.com/v2/popular?mode=lastweek&count=50').then(function (body) {
    body.json().then(function (json) {
      var searchesPending = json.map(function (track) {
        var query = encodeURIComponent(track.artist + ' ' + track.title);

        return (0, _isomorphicFetch2.default)('https://api.spotify.com/v1/search?q=' + query + '&type=track', options);
      });

      Promise.all(searchesPending).then(function (searches) {
        var resultsPending = searches.map(function (search) {
          return search.json();
        });

        Promise.all(resultsPending).then(function (results) {
          var tracksPending = results.filter(function (result) {
            return result.tracks.total;
          }).map(function (result) {
            return (0, _isomorphicFetch2.default)(result.tracks.items[0].href, options);
          });

          Promise.all(tracksPending).then(function (tracks) {
            var matchesPending = tracks.map(function (track) {
              return track.json();
            });

            Promise.all(matchesPending).then(function (matches) {
              var uris = matches.map(function (match) {
                return match.uri;
              });

              var addOpts = Object.assign({}, options, {
                method: 'POST',
                body: JSON.stringify({
                  uris: uris
                })
              });

              (0, _isomorphicFetch2.default)('https://api.spotify.com/v1/users/' + profile.id + '/playlists/' + playlist.id + '/tracks', addOpts);
            });
          });
        });
      });
    });
  });
}