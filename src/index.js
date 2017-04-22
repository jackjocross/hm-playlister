#! /usr/bin/env node

import request from 'request';
import fetch from 'isomorphic-fetch';
import {argv} from 'yargs';
import secrets from '../secrets.json';

const {client_id, client_secret, refresh_token} = secrets;

const authOptions = {
  url: 'https://accounts.spotify.com/api/token',
  headers: {
    Authorization: 'Basic ' +
      new Buffer(client_id + ':' + client_secret).toString('base64'),
  },
  form: {
    grant_type: 'refresh_token',
    refresh_token,
  },
  json: true,
};

request.post(authOptions, (error, response, {access_token}) => {
  const options = {
    headers: {Authorization: 'Bearer ' + access_token},
  };

  const profileReq = fetch('https://api.spotify.com/v1/me', options).then(res =>
    res.json(),
  );
  const playlistsReq = fetch(
    'https://api.spotify.com/v1/me/playlists',
    options,
  ).then(res => res.json());

  Promise.all([profileReq, playlistsReq]).then(([profile, playlists]) => {
    const playlist = playlists.items.filter(item => item.name === argv.name)[0];
    if (playlist) {
      populate(playlist.id, profile.id, options);
    } else {
      const createOpts = Object.assign({}, options, {
        method: 'POST',
        body: JSON.stringify({
          name: argv.name,
        }),
      });
      fetch(
        `https://api.spotify.com/v1/users/${profile.id}/playlists`,
        createOpts,
      )
        .then(response => {
          return response.json();
        })
        .then(newPlaylist => {
          populate(newPlaylist.id, profile.id, options);
        });
    }
  });
});

function populate(playlistId, profileId, options) {
  fetch(`https://api.hypem.com/v2/popular?mode=${argv.mode}&count=50`)
    .then(res => res.json())
    .then(tracks => {
      const sparseUris = tracks.map(track => {
        const query = encodeURIComponent(`${track.artist} ${track.title}`);

        return fetch(
          `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
          options,
        )
          .then(res => res.json())
          .then(
            res =>
              (res.tracks && res.tracks.total
                ? fetch(res.tracks.items[0].href, options).then(res =>
                    res.json(),
                  )
                : Promise.resolve({})),
          )
          .then(res => Promise.resolve(res.uri));
      });

      Promise.all(sparseUris).then(sparseUris =>
        fetch(
          `https://api.spotify.com/v1/users/${profileId}/playlists/${playlistId}/tracks`,
          {
            ...options,
            method: 'PUT',
            body: JSON.stringify({
              uris: sparseUris.filter(uri => uri),
            }),
          },
        ),
      );
    });
}
