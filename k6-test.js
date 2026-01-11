import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 50 },   // Ramp up to 50 VUs
        { duration: '2m', target: 100 },   // Stay at 100 VUs
        { duration: '30s', target: 200 },  // Spike to 200 VUs
        { duration: '1m', target: 200 },   // Hold at 200 VUs
        { duration: '30s', target: 0 },    // Ramp down
    ],
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