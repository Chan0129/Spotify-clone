import axios from 'axios';
import { getFromLocalStorageWithExpiry, setLocalStorageWithExpiry } from '../localstorage';

/* eslint-disable import/no-anonymous-default-export */
const client_id = process.env.REACT_APP_CLIENT_ID as string;
const redirect_uri = process.env.REACT_APP_REDIRECT_ID as string;

const authUrl = new URL('https://accounts.spotify.com/authorize');

const SCOPES = [
  'streaming',
  'user-read-private',
  'user-read-email',
  'user-read-recently-played',
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-library-modify',
  'user-follow-modify',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-playback-position',
  'user-top-read',
  'user-follow-modify',
  'user-follow-read',
  'ugc-image-upload',
] as const;

const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

const base64encode = (input: ArrayBuffer) => {
  // @ts-ignore
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const generateRandomString = (length: number) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
};

const logInWithSpotify = async () => {
  let codeVerifier = localStorage.getItem('code_verifier');

  if (!codeVerifier) {
    codeVerifier = generateRandomString(64);
    localStorage.setItem('code_verifier', codeVerifier);
  }

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  const params = {
    client_id,
    redirect_uri,
    scope: SCOPES.join(' '),
    response_type: 'code',
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  };

  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString();
};

const requestToken = async (code: string) => {
  const code_verifier = localStorage.getItem('code_verifier') as string;

  const body = {
    code,
    client_id,
    redirect_uri,
    code_verifier,
    grant_type: 'authorization_code',
  };

  const { data: response } = await axios.post<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
  }>('https://accounts.spotify.com/api/token', body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  setLocalStorageWithExpiry('access_token', response.access_token, response.expires_in * 60 * 60);
  localStorage.setItem('refresh_token', response.refresh_token);

  return response.access_token;
};

const getToken = async () => {
  const token = getFromLocalStorageWithExpiry('access_token');
  if (token) return token;

  const urlParams = new URLSearchParams(window.location.search);
  let code = urlParams.get('code') as string;

  if (!code) return null;

  return await requestToken(code);
};

export const getRefreshToken = async () => {
  // refresh token that has been previously stored
  const refreshToken = localStorage.getItem('refresh_token') as string;

  const url = 'https://accounts.spotify.com/api/token';

  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  };
  const body = await fetch(url, payload);
  const response = await body.json();
  setLocalStorageWithExpiry('access_token', response.access_token, response.expires_in * 60 * 60);
  if (response.refreshToken) {
    localStorage.setItem('refresh_token', response.refreshToken);
  }
  return response.access_token;
};

export default { logInWithSpotify, getToken, getRefreshToken };
