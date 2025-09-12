#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const SRC = path.join('normalized_data','general_notes.csv');
const DST = path.join('public','general_notes.csv');
const data = fs.readFileSync(SRC,'utf8');
fs.writeFileSync(DST,data,'utf8');
console.log('Rebuilt public/general_notes.csv from normalized_data/general_notes.csv');

