import * as fs from 'fs';
import * as path from 'path';
import * as pathh from 'path';

const srcDir = './';      // Исходная папка
const destDir = './build'; // Папка назначения

function deleteFolderInit() {
  var deleteFolderRecursive = function (path: string) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(function (file, index) {
        var curPath = pathh.join(path, file);
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  };
  if (fs.existsSync(destDir)) {
    console.log("Deleting...")
    deleteFolderRecursive(destDir)
    console.log("Deleting complete!")
  } else {
    console.log("Dir not need to be deleted")
  }
}

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

async function copyFilesInit() {
  await copyFiles(srcDir, destDir)
  console.log('Copying completed.')
}

import * as process from "node:child_process";

function runTscInit() {
  console.log("Run tsc...")
  process.execSync("tsc")
  console.log("tsc completed!")
}

import * as UglifyJS from 'uglify-js';

function miniBuildJsInit() {
  const dir = destDir;
  //mini js
  var minijs = (name: string) => {
    console.log("Minimizing: " + name)
    fs.writeFileSync(name + ".min.js", UglifyJS.minify(fs.readFileSync(name + ".js", "utf8")).code, "utf8");
  }

  const filePath = path.join(dir, `/static/index.js`);
  if (fs.existsSync(filePath)) {
    minijs(filePath.replace(".js", ""));
  }

  fs.readdirSync(path.join(dir, `/content`)).forEach((dirent: string) => {
    const filePath = path.join(dir, `/content`, dirent, "index.js");
    if (fs.existsSync(filePath)) {
      minijs(filePath.replace(".js", ""));
    }
  });
  console.log("Minimizing complete!")
}

(async function () {
  deleteFolderInit()
  console.log("")
  await copyFilesInit()
  console.log("")
  runTscInit()
  console.log("")
  miniBuildJsInit()
  console.log("")
  console.log("Finish!")
})().catch(console.error);