import * as fs from 'fs';
import * as path from 'path';
import * as processThis from 'process';
import * as UglifyJS from 'uglify-js';
import { styleText } from 'node:util';
import * as process from "node:child_process";
const srcDir = './';      // Исходная папка
const destDir = './build'; // Папка назначения

const args = {
  watch: processThis.argv.some((e)=>e=="-watch"),
  clear: processThis.argv.some((e)=>e=="-clear")
}

function deleteFolderInit() {
  var deleteFolderRecursive = function (recursePath: string) {
    if (fs.existsSync(recursePath)) {
      fs.readdirSync(recursePath).forEach(function (file, index) {
        var curPath = path.join(recursePath, file);
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(recursePath);
    }
  };
  if (fs.existsSync(destDir)) {
    console.log("Deleting...")
    deleteFolderRecursive(destDir)
    console.log("Deleting complete!")
  } else {
    console.error("Dir not need to be deleted")
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
      const ignoredFiles = ["readme.md", "tsconfig.json", "build.js", "js_final.zip", "update_and_release.bat", ".gitignore"];

      if (ignoredFiles.includes(entry.name.toLowerCase())) 
      {
          continue;
      }
      await fs.promises.copyFile(srcPath, destPath); // Копируем файлы, кроме .ts
      console.log(`Copied: ${srcPath} -> ${destPath}`);
    }
  }
}

async function copyFilesInit() {
  await copyFiles(srcDir, destDir)
  console.log('Copying completed.')
}


function runTscInit() {
  console.log("Run tsc...")
  var execCommand = "tsc";
  if (args.watch)
  {
    execCommand += " --watch";
  }
  process.execSync(execCommand, {stdio: 'inherit'})
  console.log("tsc completed!")
}


function miniBuildJsInit() {
  const dir = destDir;
  //mini js
  var minijs = (name: string) => {
    var realName = name + ".js"
    console.log("Minimizing: " + realName + " to " + name + ".min.js")
    fs.writeFileSync(name + ".min.js", UglifyJS.minify(fs.readFileSync(realName, "utf8")).code, "utf8");
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

function clearBuildDir() {
  var deleteFolderRecursive = function (recursePath: string) {
    if (fs.existsSync(recursePath)) {
      fs.readdirSync(recursePath).forEach(function (file, index) {
        var curPath = path.join(recursePath, file);
        const ignoredFiles = ["build.js", "node_modules", "build", "js_final.zip", "update_and_release.bat", "package.json", "package-lock.json"];

        if (ignoredFiles.includes(curPath.toLowerCase())) {
          return;
        }
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(recursePath);
    }
  };
  if (fs.existsSync(srcDir)) {
    console.log("Deleting...")
    deleteFolderRecursive(srcDir)
    console.log("Deleting complete!")
  } else {
    console.error("Dir not need to be deleted")
  }
}

(async function () {
  deleteFolderInit()
  await copyFilesInit()
  runTscInit()
  miniBuildJsInit()
  if (args.clear) {
    try {
      clearBuildDir()
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.name + "\n" + e.message + "\n" + e.stack)
      } else {
        console.error(e);
      }
    }
  }
  console.log("Finish!")
})().catch(console.error);