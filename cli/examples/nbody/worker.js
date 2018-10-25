/** @file	job.js	        Job for n-body simulation example
 *  @author	Greg Agnew
 *  @date	Feb 2018
 */

let
inB             = d,
outB            = [].concat(inB.slice(s[0] * 14, s[1] * 14)),
dt              = s[2],
g               = s[3],
collisionMass   = 0,
collisionRadius = 0,
collision       = false,
outPos          = 1 * 14,
inPos           = outPos + s[0];

if(inB[inPos] === 0) return;

outB[outPos + 0] = inB[inPos + 0];
outB[outPos + 1] = inB[inPos + 1];

outB[outPos + 2] = 0;
outB[outPos + 3] = 0;
outB[outPos + 4] = 0;

outB[outPos + 5] = inB[inPos + 5];
outB[outPos + 6] = inB[inPos + 6];
outB[outPos + 7] = inB[inPos + 7];

outB[outPos + 8] = inB[inPos + 8];
outB[outPos + 9] = inB[inPos + 9];
outB[outPos + 10] = inB[inPos + 10];

outB[outPos + 11] = 0;
outB[outPos + 12] = 0;
outB[outPos + 13] = 0;
  
for(let i = 0; i < inB.length; i = 14 + i){
  if(i === inPos || inB[i] === 0) continue;

  let dR = [
    inB[i + 5] - inB[inPos + 5],
    inB[i + 6] - inB[inPos + 6],
    inB[i + 7] - inB[inPos + 7]
  ]

  let magnitude = Math.sqrt(dR[0] * dR[0] + dR[1] * dR[1] + dR[2] * dR[2]);

  if(magnitude <= inB[inPos] + inB[i]){
    if(inB[i] > inB[inPos] || (inB[i] === inB[inPos] && inPos > i)){
      outB[outPos] = 0;
      break;
    }
    collision = true;

    let totalMass = collisionMass + inB[i + 1];
    outB[outPos + 2] = ((outB[outPos + 2] * collisionMass) + (inB[i + 8] * inB[i + 1])) / totalMass;
    outB[outPos + 3] = ((outB[outPos + 3] * collisionMass) + (inB[i + 9] * inB[i + 1])) / totalMass;
    outB[outPos + 4] = ((outB[outPos + 4] * collisionMass) + (inB[i + 10] * inB[i + 1])) / totalMass;

    collisionRadius += inB[i];
    collisionMass = totalMass;
  }else{
    let _g = g * inB[i + 1] / Math.pow(magnitude, 3);
    outB[outPos + 11] = (dR[0] * _g) + outB[outPos + 11];
    outB[outPos + 12] = (dR[1] * _g) + outB[outPos + 12];
    outB[outPos + 13] = (dR[2] * _g) + outB[outPos + 13];
  }

  if(collision){
    let totalMass = inB[inPos + 1] + collisionMass;

    let dv = [
      ((inB[inPos + 8] * inB[inPos + 1]) + (outB[outPos + 2] * collisionMass)) / totalMass,
      ((inB[inPos + 9] * inB[inPos + 1]) + (outB[outPos + 3] * collisionMass)) / totalMass,
      ((inB[inPos + 10] * inB[inPos + 1]) + (outB[outPos + 4] * collisionMass)) / totalMass
    ];

    outB[outPos] = Math.pow(collisionRadius, 1 / 3) + outB[outPos];
    outB[outPos + 1] = totalMass;

    outB[outPos + 8] = dv[0];
    outB[outPos + 9] = dv[1];
    outB[outPos + 10] = dv[2];
  }

  let dv = [
    outB[outPos + 11] * dt,
    outB[outPos + 12] * dt,
    outB[outPos + 13] * dt
  ];

  outB[outPos + 5] = (outB[outPos + 8] * dt) + (dv[0] * 0.5 * dt) + outB[outPos + 5];
  outB[outPos + 6] = (outB[outPos + 9] * dt) + (dv[1] * 0.5 * dt) + outB[outPos + 6];
  outB[outPos + 7] = (outB[outPos + 10] * dt) + (dv[2] * 0.5 * dt) + outB[outPos + 7];

  outB[outPos + 8] = dv[0] + outB[outPos + 8];
  outB[outPos + 9] = dv[1] + outB[outPos + 9];
  outB[outPos + 10] = dv[2] + outB[outPos + 10];
}
return outB;