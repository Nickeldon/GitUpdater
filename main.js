const fs = require("fs");
const path = require("path");
const IsGitHubURL = require("is-github-url");
const download = require("download");

function compareVersions(compareURL, force) {
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

  let packageJson, currentVersion, version, minor, major, patch, additional;
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
        let latestVersion = data.tag_name;
        let latest = latestVersion.split(".");
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
          let state = compareSemantic(latest, version);

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
    let latestMajor = parseInt(VerNew[0]);
    let latestMinor = parseInt(VerNew[1]);
    let latestPatch = parseInt(VerNew[2]);

    let major = parseInt(VerOld[0]);
    let minor = parseInt(VerOld[1]);
    let patch = parseInt(VerOld[2]);

    if (latestMajor > major) {
      console.log("Major version is outdated");
      state = "outdated";
    } else if (latestMajor < major) {
      console.log("Major version is up-to-date");
      state = "up-to-date";
    } else {
      if (latestMinor > minor) {
        console.log("Minor version is outdated");
        state = "outdated";
      } else if (latestMinor < minor) {
        console.log("Minor version is up-to-date");
        state = "up-to-date";
      } else {
        if (latestPatch > patch) {
          console.log("Patch version is outdated");
          state = "outdated";
        } else if (latestPatch < patch) {
          console.log("Patch version is up-to-date");
          state = "up-to-date";
        } else {
          console.log("All versions are up-to-date");
          state = "up-to-date";
        }
      }
    }
    console.log(`Current Version => ${version} \nLatest Version => ${latest}`);

    return [state, version, latest];
  }
}

module.exports = {
  compareVersions: (compareURL, force) => compareVersions(compareURL, force)[0],

  autoUpdater: ({
    GitHubURL,
    GitHubBranch,
    tempLocation,
    exitWhenComplete,
    force,
    doubleBackup,
  }) => {
    console.log("autoUpdater");
    let state;
    if (!force) state = compareVersions(GitHubURL, force)[0];

    if (
      IsGitHubURL(GitHubURL, { repository: true }) &&
      GitHubBranch &&
      IsGitHubURL(`${GitHubURL}/tree/${GitHubBranch}`, { repository: true })
    ) {
      if (force) state = "outdated";

      if (state === "outdated") {
        console.log("Downloading latest version");

        const url = GitHubURL;
        const RepoName = url.split("/")[url.split("/").length - 1];

        let temp, tempFile;

        if (tempLocation) {
          temp = path.join(tempLocation);
          tempFile = path.join(temp, "temp.zip");
        } else {
          console.error("No temp location provided");
          return 0;
        }

        let zipURL = `${url}/archive/refs/heads/${GitHubBranch}.zip`;

        download(zipURL, temp, { extract: true }).then(() => {
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
            fs.cpSync(temp + `/${RepoName}-${GitHubBranch}`, process.cwd(), {
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
