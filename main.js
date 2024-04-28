const fs = require("fs");
const path = require("path");
const IsGitHubURL = require("is-github-url");
const download = require("download");

function CompareVersions(compareURL, force) {
  let packageJson,
    currentVersion,
    version,
    minor,
    major,
    patch,
    additional,
    latestVersion,
    latest;
  console.log("compareVersions");
  let packageData;
  try {
    packageData = fs.readFileSync(
      path.join(process.cwd(), "/package.json").replace(/\\/g, "/")
    );
  } catch (e) {
    console.error("No package.json found");
  }

  if (!packageData) if (!force) return 0;

  if (!force) {
    packageJson = JSON.parse(packageData);

    currentVersion = packageJson.version;

    version = currentVersion.split(".");

    if (version.length < 3) {
      console.error("Version in package.json is not in correct format");
      return 0;
    } else if (version.length > 3) {
      major = parseInt(version[0]);
      minor = parseInt(version[1]);
      patch = parseInt(version[2]);
      additional = version[3];
    } else {
      major = parseInt(version[0]);
      minor = parseInt(version[1]);
      patch = parseInt(version[2]);
    }
  }

  //Compare the versions from the URL (If URL is a GitHub repo URL)

  if (IsGitHubURL(compareURL, { repository: true })) {
    console.log("URL is a GitHub URL");
    let url = compareURL.split("/");
    const repo = url[url.length - 1];
    const owner = url[url.length - 2];
    url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        console.log("Fetched latest version from GitHub");
        latestVersion = data.tag_name;
        latest = latestVersion.split(".");
        let latestMinor, latestMajor, latestPatch, latestAdditional;
        if (latest.length < 3) {
          console.error("Version in package.json is not in correct format");
          return 0;
        } else if (latest.length > 3) {
          latestMajor = parseInt(latest[0]);
          latestMinor = parseInt(latest[1]);
          latestPatch = parseInt(latest[2]);
          latestAdditional = latest[3];
        } else {
          latestMajor = parseInt(latest[0]);
          latestMinor = parseInt(latest[1]);
          latestPatch = parseInt(latest[2]);
        }

        if (!force) {
          let state = compareSemantic(latest, version)[0];

          if (state === "outdated") {
            console.log("Current version is outdated");
            console.log("Latest version is: " + latestVersion);
          } else if (state === "up-to-date") {
            console.log("Current version is up-to-date");
            console.log("Latest version is: " + latestVersion);
          } else {
            console.error("Error in comparing versions");
            return 0;
          }
        }
      });
  } else {
    console.error("URL is not a GitHub URL");
    return 0;
  }

  function compareSemantic(VerNew, VerOld) {
    let state;

    let newVersion = [];
    let oldVersion = [];
    let oldAdditional = oldVersion.slice(3, oldVersion.length - 1);
    let newAdditional = newVersion.slice(3, newVersion.length - 1);

    VerNew.forEach((elem) => {
      newVersion.push(elem.replace(/\D/g, ""));
    });
    VerOld.forEach((elem) => {
      oldVersion.push(elem.replace(/\D/g, ""));
    });

    let latestMajor = parseInt(newVersion[0]);
    let latestMinor = parseInt(newVersion[1]);
    let latestPatch = parseInt(newVersion[2]);

    let major = parseInt(oldVersion[0]);
    let minor = parseInt(oldVersion[1]);
    let patch = parseInt(oldVersion[2]);

    console.log(latestMajor, latestMinor, latestPatch);
    //console.log(major, minor, patch);

    if (latestMajor > major || latestMinor > minor || latestPatch > patch) {
      console.log("GitHub version is newer than local version");
      state = "outdated";
    } else if (
      latestMajor <= major ||
      latestMinor <= minor ||
      latestPatch <= patch
    ) {
      console.log("GitHub version is older than local version");
      state = "up-to-date";
    }
    let completeOldVersion = version.join(".");
    let completeNewVersion = latest.join(".");
    console.log(
      `\n\nCurrent Version => ${completeOldVersion} \nLatest Version => ${completeNewVersion}\n`
    );

    return [state, version, latest];
  }
}

module.exports = {
  compareVersions: (compareURL, force) => CompareVersions(compareURL, force),

  autoUpdater: (
    GitHubURL,
    { tempLocation, exitWhenComplete, force, doubleBackup }
  ) => {
    console.log("autoUpdater");
    let metadata = CompareVersions(GitHubURL, force);
    console.log(metadata);
    if (!force) state = metadata[0];

    if (
      IsGitHubURL(GitHubURL, { repository: true })
    ) {
      if (force) state = "outdated";

      if (state === "outdated") {
        console.log("Downloading latest version");

        let url = GitHubURL.split("/");
        const RepoName = url[url.length - 1];
        const owner = url[url.length - 2];

        let temp, tempFile;

        if (tempLocation) {
          temp = path.join(tempLocation);
          tempFile = path.join(temp, "temp.zip");
        } else {
          console.error("No temp location provided");
          return 0;
        }

        url = `https://api.github.com/repos/${owner}/${RepoName}/releases/latest`;;
        
        fetch(url)
          .then((response) => response.json())
          .then((data) => {
            console.log(data);
            zipURL = data.zipball_url;

            download(zipURL, temp, { extract: true, filename:"tempDirectory" }).then(() => {
                console.log("Downloaded Latest Extracted Version");
                if (tempLocation) {
                  try {
                    console.log("Saving current directory to temp directory...");
                    fs.cpSync(process.cwd(), temp + "/backup", { recursive: true })
                      .then(() => {
                        console.log("Saved current directory to temp directory");
                      })
                      .catch((e) => {
                        console.error(
                          "Error in saving current directory to temp directory\n"
                        );
                        console.log(e);
                        return 0;
                      });
                  } catch (e) {
                    console.error(
                      "Error in saving current directory to temp directory\n"
                    );
                    console.log(e);
                    return 0;
                  }
                }
      
                if (doubleBackup)
                  console.log(
                    "Deleting current directory and starting second backup..."
                  );
                else console.log("Deleting current directory...");
      
                try {
                  fs.rmSync(process.cwd(), { recursive: true });
                } catch (e) {
                  console.error("Error in deleting current directory\n");
                  console.log(e);
                  return 0;
                }
      
                console.log("Deleted current directory");
      
                console.log("Extracting latest version...");
      
                try {
                  fs.cpSync(temp + `/tempDirectory`, process.cwd(), {
                    recursive: true,
                  });
                } catch (e) {
                  console.error("Error in extracting latest version\n");
                  console.log(e);
                  return 0;
                }
      
                console.log("Extracted latest version");
                if (exitWhenComplete) process.exit(0);
              });
          })
          .catch((e) => {
            console.error("Error in fetching latest version\n");
            console.log(e);
            return 0;
          });
      } else if (state === "up-to-date") {
        console.log("No updates available");
        return 0;
      } else {
        console.error("Error in comparing versions");
        return 0;
      }
    } else {
      console.error("URL is not a GitHub URL");
      return 0;
    }
  },
};
