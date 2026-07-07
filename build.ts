import * as fs from 'fs';
import * as path from 'path';
import * as processThis from 'process';
import * as UglifyJS from 'uglify-js';
import { styleText } from 'node:util';
import * as process from "node:child_process";
import { exit } from 'node:process';
import chokidar from 'chokidar'; // умного watch

const srcDir = './';      // Исходная папка
const destDir = './build'; // Папка назначения

const ignoredFiles = new Set(["readme.md", "tsconfig.json", "build.js", "js_final.zip", "update_and_release.bat", ".gitignore"]);
const ignoredDirs = new Set([".git", "build", "node_modules", "images_for_readme"]);

const args = {
  watch: processThis.argv.some((e) => e == "--watch" || e == "-w"),
  clear: processThis.argv.some((e) => e == "--clear" || e == "-c"),
  help: processThis.argv.some((e) => e == "--help" || e == "-h"),
}

function printTips() {
  function getScriptName(): string {
    // В Node.js имя файла можно получить из process.argv[1]
    const path = processThis.argv[0].split(/[\\/]/).pop() + " " + processThis.argv[1].split(/[\\/]/).pop();
    return path || styleText("bold", 'Unknow script name');
  }
  console.log(`Usage ${styleText("blue", getScriptName())}:`);
  console.log(`\t${styleText("green", "--watch -w")} to enable incremental watch mode (TS + Static assets)`);
  console.log(`\t${styleText("green", "--clear -c")} to clear build folder`);
  console.log(`\t${styleText("green", "--help -h")} prints this help text`);
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
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyFiles(srcPath, destPath); // Рекурсивно обрабатываем папки
    } else if (!entry.name.endsWith('.ts')) {

      if (ignoredFiles.has(entry.name.toLowerCase())) {
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

function runTsc() {
  console.log("Run tsc...")
  process.execSync("tsc", { stdio: 'inherit' })
  console.log("tsc completed!")
}

function runTscWatch() {
  console.log("Run tsc in --watch mode...")
  process.spawn("tsc", ["--watch"], { stdio: 'inherit', shell: true })
  console.log("tsc --watch completed!")
}


function miniBuildJsSignle(fullPath: string) {
      const minPath = fullPath.replace(/\.js$/, '.min.js');

      console.log(`Minimizing: ${fullPath} -> ${minPath}`);

      try {
        const originalCode = fs.readFileSync(fullPath, "utf8");
        const minified = UglifyJS.minify(originalCode);

        if (minified.error) {
          console.error(`[Uglify Error] inside ${fullPath}:`, minified.error);
          return;
        }

        fs.writeFileSync(minPath, minified.code, "utf8");
      } catch (err) {
        console.error(`Failed to minimize ${fullPath}:`, err);
      }
}
function miniBuildJs() {
  const dir = destDir;

  if (!fs.existsSync(dir)) {
    console.error(`Directory ${dir} does not exist.`);
    return;
  }

  console.log("Minimizing all JS files in build directory...");

  // Рекурсивно читаем все файлы и папки внутри destDir
  // withFileTypes: true позволит легко отсеять папки
  const allFiles = fs.readdirSync(dir, { recursive: true, withFileTypes: true });

  for (const entry of allFiles) {
    // Нам нужны только файлы, которые заканчиваются на .js, 
    // но при этом мы игнорируем уже минифицированные (.min.js)
    if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.min.js')) {

      // entry.parentPath содержит путь к папке файла относительно исходной точки (в Node v20+)
      // Если у вас старая нода, можно собирать путь через path.join(dir, entry.path, entry.name)
      const fullPath = path.join(entry.parentPath || entry.path || dir, entry.name);
      miniBuildJsSignle(fullPath)
    }
  }
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
  if (args.help) {
    printTips()
    return
  }
  deleteFolderInit()
  if (args.watch) {
    runTscWatch();
    const watcher = chokidar.watch(srcDir, {
      ignored: [
        ...Array.from(ignoredDirs).map(d => `**/${d}/**`),
        ...Array.from(ignoredFiles).map(f => `**/${f}`)
      ],
      persistent: true,
    })

    async function onChange(srcPath: string) {
      // Если это TS файл — его обработает сам tsc --watch, этот скрипт его игнорирует
      if (srcPath.endsWith('.ts')) return;

      // Вычисляем путь назначения в папке build
      const relativePath = path.relative(srcDir, srcPath);
      const destPath = path.join(destDir, relativePath);
      // Проверяем игнорирование
      const parts = relativePath.split(path.sep);
      if (parts.some(part => ignoredDirs.has(part))) return;
      if (ignoredFiles.has(path.basename(srcPath).toLowerCase())) return;

      try {
        // Создаем директорию, если её нет
        await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
        // Копируем файл
        await fs.promises.copyFile(srcPath, destPath);
        console.log(`[Watch - Copied] ${srcPath} -> ${destPath}`);
      } catch (err) {
        console.error(styleText("red", `[Watch - Error] Failed to process ${srcPath}: ${err}`));
      }

    }
    watcher.on("add", onChange)
    watcher.on("change", onChange)

    async function onBuildChange(srcPath: string) {
      // Если tsc обновил index.js в билде и это не минифицированный файл
      if (srcPath.endsWith('.js') && !srcPath.endsWith('.min.js')) {
        console.log(`[Watch] Updated js file: ${srcPath}. Reminifying...`);
        miniBuildJsSignle(srcPath);
      }
    }

    // Дополнительный трюк: отслеживаем, когда сам TSC обновляет скомпилированные .js файлы в папке build, 
    // чтобы автоматически перезапускать минификацию ТОЛЬКО для них!
    const buildWatcher = chokidar.watch(destDir, { persistent: true });
    buildWatcher.on('change', onBuildChange);
    buildWatcher.on('add', onBuildChange);

  } else if (args.clear) {
    try {
      clearBuildDir()
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.name + "\n" + e.message + "\n" + e.stack)
      } else {
        console.error(e);
      }
    }
    console.log("Clearing finished!")
  } else {
    await copyFilesInit()
    runTsc()
    miniBuildJs()
    console.log("Finish!")
  }
})().catch(console.error);