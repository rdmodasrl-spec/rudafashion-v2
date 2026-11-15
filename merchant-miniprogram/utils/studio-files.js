const studioFileTypes = {
  jpg: { contentType: 'image/jpeg', maxBytes: 12 * 1024 * 1024 },
  jpeg: { contentType: 'image/jpeg', maxBytes: 12 * 1024 * 1024 },
  png: { contentType: 'image/png', maxBytes: 12 * 1024 * 1024 },
  webp: { contentType: 'image/webp', maxBytes: 12 * 1024 * 1024 },
  pdf: { contentType: 'application/pdf', maxBytes: 50 * 1024 * 1024 },
  dxf: { contentType: 'application/dxf', maxBytes: 50 * 1024 * 1024 },
  glb: { contentType: 'model/gltf-binary', maxBytes: 25 * 1024 * 1024 }
};

function inspectStudioFile(file) {
  const fileName = String(file && file.name || '').trim();
  const extension = fileName.split('.').pop().toLowerCase();
  const type = studioFileTypes[extension];
  const sizeBytes = Number(file && file.size);
  if (!fileName || !type) throw new Error('文件类型不受支持，请选择 JPG、PNG、WebP、PDF、DXF 或 GLB。');
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > type.maxBytes) {
    throw new Error('文件大小无效或超出该类型的上传限制。');
  }
  return { fileName, contentType: type.contentType, sizeBytes };
}

function uploadStudioFile(uploadUrl, filePath, contentType) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      success(file) {
        wx.request({
          url: uploadUrl,
          method: 'PUT',
          data: file.data,
          header: {
            'Content-Type': contentType,
            'Cache-Control': 'private,no-store'
          },
          timeout: 60000,
          success(response) {
            if (response.statusCode >= 200 && response.statusCode < 300) resolve();
            else reject(new Error(`文件上传失败（${response.statusCode}）。`));
          },
          fail() {
            reject(new Error('文件上传失败，请检查网络和微信上传域名配置。'));
          }
        });
      },
      fail() {
        reject(new Error('无法读取所选文件，请重新选择。'));
      }
    });
  });
}

module.exports = { inspectStudioFile, uploadStudioFile };
