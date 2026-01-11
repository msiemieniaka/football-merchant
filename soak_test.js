import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 30 },    // szybki ramp-up do 30 VU
    { duration: '56m', target: 30 },   // utrzymaj 56 minut
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<0.8'],
    'http_reqs': ['rate>150'],
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
