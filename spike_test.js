import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 0 },
    { duration: '30s', target: 60 },  // skok do 60 VU
    { duration: '2m', target: 60 },  // utrzymaj 2 min
    { duration: '30s', target: 10 },  // szybki spadek do 10
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1'],  // 95% <1s
  },
};

// Test the backend API which actually uses CPU
const BASE_URL = 'http://127.0.0.1/api';

export default function () {
  // These endpoints hit the backend and use CPU
  const matches = http.get(`${BASE_URL}/matches`);
  check(matches, { 'matches status 200': (r) => r.status === 200 });

  const table = http.get(`${BASE_URL}/table`);
  check(table, { 'table status 200': (r) => r.status === 200 });

  // Add some randomness to simulate real traffic
  sleep(Math.random() * 0.5);
}
