import * as fs from 'fs';
import * as path from 'path';

const srcDir = './';      // Исходная папка
const destDir = './build'; // Папка назначения

async function copyFiles(src: string, dest: string) {
  await fs.promises.mkdir(dest, { recursive: true }); // Создаем папку назначения


  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    //ignores 
    if (entry.isDirectory() && (entry.name == ".git" || entry.name == "build" || entry.name == "node_modules")) {
      continue
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyFiles(srcPath, destPath); // Рекурсивно обрабатываем папки
    } else if (!entry.name.endsWith('.ts')) {
      await fs.promises.copyFile(srcPath, destPath); // Копируем файлы, кроме .ts
      console.log(`Copied: ${srcPath} -> ${destPath}`);
    }
  }
}

async function copyFilesInit(){
  await copyFiles(srcDir, destDir)
  console.log('Copying completed.')
}


import * as UglifyJS from 'uglify-js';

function miniBuildJs(dir: string) {
  //mini js
  var minijs = (name: string) => {
    console.log("Minimizing: " + name)
    fs.writeFileSync(name + ".min.js", UglifyJS.minify(fs.readFileSync(name + ".js", "utf8")).code, "utf8");
  }

  const filePath = dir + `/static/index.js`;
  if (fs.existsSync(filePath)) {
    minijs(filePath.replace(".js", ""));
  }

  fs.readdirSync(dir + "/content").forEach((dirent: string) => {
    const filePath = dir + `/content/${dirent}/index.js`;
    if (fs.existsSync(filePath)) {
      minijs(filePath.replace(".js", ""));
    }
  });
}
function miniBuildJsInit(){
  miniBuildJs(destDir)
  console.log("Minimizing complete!")
}

copyFilesInit()
  .then(miniBuildJsInit)
  .catch(console.error);