import {writeFile,mkdir} from 'node:fs/promises';
import {EXERCISES} from '../../app/js/exercises.js';
import {interpolatePose,renderPose,figureDefs,figureViewBox,movementArrow} from '../../app/js/figure.js';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{Resvg}=require('@resvg/resvg-js');
const cells=EXERCISES.map((ex,index)=>`<g transform="translate(${index%4*450},${Math.floor(index/4)*230})"><rect width="450" height="230" fill="white" stroke="#ddd"/><text x="12" y="22" font-size="16" font-family="Arial" fill="#222">${ex.id}</text>${[0,.5,1].map((t,i)=>`<svg x="${i*150}" y="30" width="150" height="180" viewBox="${figureViewBox(ex)}">${figureDefs(ex.id+i)}${renderPose(interpolatePose(ex.frames[0],ex.frames[movementArrow(ex)?.peak??1]||ex.frames[0],t,ex),ex,ex.id+i)}</svg><text x="${i*150+12}" y="220" font-size="12" fill="#333">${['Start','Mid','Peak'][i]}</text>`).join('')}</g>`).join('');
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2300"><style>.prop-o{fill:#e5e7eb;stroke:#6b7280;stroke-width:2}.prop-l{fill:none;stroke:#6b7280;stroke-width:4}.prop-t{fill:none;stroke:#6b7280;stroke-width:2}.prop{fill:#6b7280}</style>${cells}</svg>`;
svg=svg.replaceAll('var(--muscle-primary)','#dc3333').replaceAll('var(--muscle-secondary)','#e98174').replaceAll('var(--muscle-neutral)','#bfc4cc');
await mkdir('docs/round11-screens',{recursive:true});await writeFile('docs/round11-screens/poses.svg',svg);await writeFile('docs/round11-screens/poses.png',new Resvg(svg).render().asPng());console.log('Saved contact sheet of actual SVG renderer, 40 exercises × start/mid/peak.');
