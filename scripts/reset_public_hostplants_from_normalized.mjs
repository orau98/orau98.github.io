#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const SRC = path.join('normalized_data','hostplants.csv');
const DST = path.join('public','hostplants.csv');

const data = fs.readFileSync(SRC,'utf8');
fs.writeFileSync(DST,data,'utf8');
console.log('Rebuilt public/hostplants.csv from normalized_data/hostplants.csv');

