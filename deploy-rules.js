const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Verificar se o Firebase CLI está instalado
try {
  execSync('firebase --version', { stdio: 'ignore' });
} catch (error) {
  console.error('Firebase CLI não está instalado. Instalando...');
  execSync('npm install -g firebase-tools', { stdio: 'inherit' });
}

// Verificar se o usuário está logado no Firebase
try {
  execSync('firebase projects:list', { stdio: 'ignore' });
} catch (error) {
  console.log('Você precisa fazer login no Firebase. Execute:');
  console.log('firebase login');
  process.exit(1);
}

// Implantar regras do Firestore
console.log('Implantando regras do Firestore...');
execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });

// Implantar regras do Storage
console.log('Implantando regras do Storage...');
execSync('firebase deploy --only storage', { stdio: 'inherit' });

console.log('Regras implantadas com sucesso!'); 