var createImageBitmapOK = self.createImageBitmap ? true : false;

onmessage = function (evt) {
    var data = evt.data;//通过evt.data获得发送来的数据
    if (data != null && typeof (data.url) === "string")
        loadImage2(data.url, data.options);
}

var enableTrace = false;
var ifShowTraceToMain = false;
function myTrace(msg) {
    if (!enableTrace) return;
    //console.log("png:" + msg)
    if (ifShowTraceToMain) {
        showMsgToMain(msg);
    }
}

function loadImage2(url, options) {
    var failed = false;
    var xhr = new XMLHttpRequest;
    // xhr.open("GET", url, true);

    //caochangli - 相对路径下载时因workerloader.js脚本在libs中，导致下载地址错误
    var sendUrl = url;
    if (webHost && !sendUrl.startsWith("http://") && !sendUrl.startsWith("https://"))
        sendUrl = `${webHost}${url}`;
    xhr.open("GET", sendUrl, true);
    //caochangli - 相对路径下载时因workerloader.js脚本在libs中，导致下载地址错误

    xhr.responseType = "arraybuffer";
    myTrace("load:" + url);
    xhr.onload = function () {
        var response = xhr.response || xhr.mozResponseArrayBuffer;
        myTrace("onload:" + url);
        if ((xhr.status != 200 && xhr.status != 0) || response.byteLength < 10) {
            if (!failed) {
                failed = true;
                pngFail(url, xhr.status + ":" + xhr.statusText);
            }

            return;
        }
        var data = new Uint8Array(response);
        doCreateImageBitmap(data, url, options);

    };
    xhr.onerror = function (e) {
        pngFail(url, "loadFail");
    }

    xhr.send(null);
}

function doCreateImageBitmap(response, url, options) {
    try {
        var startTime = getTimeNow();

        response = new self.Blob([response], { type: "image/png" });
        self.createImageBitmap(response, options).then(function (imageBitmap) {
            //showMsgToMain("imageBitmapCreated:");
            var data = {};
            data.url = url;
            data.imageBitmap = imageBitmap;
            data.dataType = "imageBitmap";

            data.startTime = startTime;
            data.decodeTime = getTimeNow() - startTime;
            data.sendTime = getTimeNow();

            myTrace("png:Decode By createImageBitmap," + data.decodeTime, url);

            data.type = "Image";
            postMessage(data, [data.imageBitmap]);
        }).catch(
            function (e) {
                showMsgToMain("catch e:" + e);
                pngFail(url, "" + e);
            }
        )
    } catch (e) {
        pngFail(url, "" + e);
    }
}

function getTimeNow() {
    return new Date().getTime();
}

function disableWorker(msg) {
    var data = {};
    data.url = url;
    data.imagedata = null;
    data.type = "Disable";
    data.msg = msg;
    postMessage(data);
}

function pngFail(url, msg) {
    var data = {};
    data.url = url;
    data.imagedata = null;
    data.type = "Image";
    data.msg = msg;
    //console.log("png:" + msg + " " + url);
    postMessage(data);
}

function showMsgToMain(msg) {
    var data = {};
    data.type = "Msg";
    data.msg = msg;
    postMessage(data);
}


//caochangli - 解决workerloader.js脚本在/libs目录下，导致相对路径下载的资源多套了一层libs路径
var webHost = "";//当前网页路径
if (location && location.protocol && location.host && location.pathname)
{
    webHost = getPath(location.protocol + "//" + location.host + location.pathname);
    if (webHost.endsWith("/libs/"))
    {
        var index = webHost.lastIndexOf('/libs/');
        if (index !== -1)
            webHost = webHost.substring(0, index + 1);
    }
}

function getPath(url) {
    var ofs = url.lastIndexOf('/');
    return ofs > 0 ? url.substring(0, ofs + 1) : "";
}