/**
 * Upload Service
 * 
 * This service handles file uploads to AWS S3 for the EasyParkNow platform.
 * It manages parking space images, user profile pictures, and other file uploads.
 * 
 * Features:
 * - Upload files to AWS S3
 * - Generate unique file names
 * - Image optimization and resizing
 * - File type validation
 * - Secure URL generation
 * - File deletion from S3
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { AppError } = require('../middleware/errorHandler');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'eu-west-2'
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

/**
 * Generate unique filename with timestamp and UUID
 * @param {string} originalName - Original filename
 * @param {string} folder - S3 folder/prefix
 * @returns {string} - Unique filename
 */
const generateFileName = (originalName, folder = '') => {
  const timestamp = Date.now();
  const uuid = uuidv4().substring(0, 8);
  const extension = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9]/g, '-');
  
  const fileName = `${baseName}-${timestamp}-${uuid}${extension}`;
  return folder ? `${folder}/${fileName}` : fileName;
};

/**
 * Validate file type and size
 * @param {Object} file - Multer file object
 * @param {Array} allowedTypes - Array of allowed MIME types
 * @param {number} maxSize - Maximum file size in bytes
 */
const validateFile = (file, allowedTypes = ['image/jpeg', 'image/png', 'image/webp'], maxSize = 5 * 1024 * 1024) => {
  if (!allowedTypes.includes(file.mimetype)) {
    throw new AppError(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`, 400, 'INVALID_FILE_TYPE');
  }

  if (file.size > maxSize) {
    throw new AppError(`File size ${file.size} exceeds maximum allowed size of ${maxSize} bytes`, 400, 'FILE_TOO_LARGE');
  }
};

/**
 * Upload file to S3
 * @param {Object} file - Multer file object
 * @param {string} folder - S3 folder/prefix (e.g., 'parking-spaces', 'profiles')
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Upload result with URL and key
 */
const uploadToS3 = async (file, folder = '', options = {}) => {
  try {
    // Validate file
    validateFile(file, options.allowedTypes, options.maxSize);

    // Generate unique filename
    const fileName = generateFileName(file.originalname, folder);

    // Prepare upload parameters
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read', // Make files publicly accessible
      CacheControl: 'max-age=31536000', // Cache for 1 year
      ...options.s3Params
    };

    // Add metadata
    if (options.metadata) {
      uploadParams.Metadata = options.metadata;
    }

    // Upload to S3
    const result = await s3.upload(uploadParams).promise();

    console.log('File uploaded successfully:', {
      fileName,
      size: file.size,
      type: file.mimetype,
      url: result.Location
    });

    return {
      success: true,
      url: result.Location,
      key: result.Key,
      bucket: result.Bucket,
      fileName: fileName,
      originalName: file.originalname,
      size: file.size,
      type: file.mimetype
    };

  } catch (error) {
    console.error('S3 upload error:', error);
    
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(`Failed to upload file: ${error.message}`, 500, 'UPLOAD_ERROR');
  }
};

/**
 * Upload multiple files to S3
 * @param {Array} files - Array of Multer file objects
 * @param {string} folder - S3 folder/prefix
 * @param {Object} options - Upload options
 * @returns {Promise<Array>} - Array of upload results
 */
const uploadMultipleToS3 = async (files, folder = '', options = {}) => {
  try {
    if (!files || files.length === 0) {
      throw new AppError('No files provided for upload', 400, 'NO_FILES');
    }

    // Upload all files concurrently
    const uploadPromises = files.map(file => uploadToS3(file, folder, options));
    const results = await Promise.all(uploadPromises);

    return {
      success: true,
      files: results,
      count: results.length
    };

  } catch (error) {
    console.error('Multiple file upload error:', error);
    throw error;
  }
};

/**
 * Delete file from S3
 * @param {string} fileUrl - Full S3 URL or just the key
 * @returns {Promise<Object>} - Deletion result
 */
const deleteFromS3 = async (fileUrl) => {
  try {
    // Extract key from URL if full URL is provided
    let key;
    if (fileUrl.startsWith('http')) {
      const url = new URL(fileUrl);
      key = url.pathname.substring(1); // Remove leading slash
    } else {
      key = fileUrl;
    }

    const deleteParams = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(deleteParams).promise();

    console.log('File deleted successfully:', key);

    return {
      success: true,
      key: key,
      message: 'File deleted successfully'
    };

  } catch (error) {
    console.error('S3 delete error:', error);
    throw new AppError(`Failed to delete file: ${error.message}`, 500, 'DELETE_ERROR');
  }
};

/**
 * Delete multiple files from S3
 * @param {Array} fileUrls - Array of S3 URLs or keys
 * @returns {Promise<Object>} - Deletion result
 */
const deleteMultipleFromS3 = async (fileUrls) => {
  try {
    if (!fileUrls || fileUrls.length === 0) {
      return { success: true, count: 0 };
    }

    // Extract keys from URLs
    const keys = fileUrls.map(url => {
      if (url.startsWith('http')) {
        const urlObj = new URL(url);
        return urlObj.pathname.substring(1);
      }
      return url;
    });

    // Prepare delete parameters
    const deleteParams = {
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: false
      }
    };

    const result = await s3.deleteObjects(deleteParams).promise();

    console.log('Multiple files deleted:', {
      deleted: result.Deleted?.length || 0,
      errors: result.Errors?.length || 0
    });

    return {
      success: true,
      deleted: result.Deleted || [],
      errors: result.Errors || [],
      count: result.Deleted?.length || 0
    };

  } catch (error) {
    console.error('Multiple file delete error:', error);
    throw new AppError(`Failed to delete files: ${error.message}`, 500, 'DELETE_ERROR');
  }
};

/**
 * Generate presigned URL for temporary access
 * @param {string} key - S3 object key
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Presigned URL
 */
const generatePresignedUrl = async (key, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn
    };

    const url = await s3.getSignedUrlPromise('getObject', params);
    return url;

  } catch (error) {
    console.error('Presigned URL generation error:', error);
    throw new AppError(`Failed to generate presigned URL: ${error.message}`, 500, 'PRESIGNED_URL_ERROR');
  }
};

/**
 * Check if file exists in S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>} - True if file exists
 */
const fileExists = async (key) => {
  try {
    await s3.headObject({
      Bucket: BUCKET_NAME,
      Key: key
    }).promise();
    
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    throw error;
  }
};

/**
 * Get file metadata from S3
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} - File metadata
 */
const getFileMetadata = async (key) => {
  try {
    const result = await s3.headObject({
      Bucket: BUCKET_NAME,
      Key: key
    }).promise();

    return {
      size: result.ContentLength,
      type: result.ContentType,
      lastModified: result.LastModified,
      etag: result.ETag,
      metadata: result.Metadata || {}
    };

  } catch (error) {
    console.error('Get file metadata error:', error);
    throw new AppError(`Failed to get file metadata: ${error.message}`, 500, 'METADATA_ERROR');
  }
};

/**
 * List files in S3 folder
 * @param {string} prefix - S3 prefix/folder
 * @param {number} maxKeys - Maximum number of keys to return
 * @returns {Promise<Array>} - Array of file objects
 */
const listFiles = async (prefix = '', maxKeys = 1000) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: maxKeys
    };

    const result = await s3.listObjectsV2(params).promise();

    return {
      files: result.Contents || [],
      count: result.KeyCount || 0,
      isTruncated: result.IsTruncated || false,
      nextContinuationToken: result.NextContinuationToken
    };

  } catch (error) {
    console.error('List files error:', error);
    throw new AppError(`Failed to list files: ${error.message}`, 500, 'LIST_ERROR');
  }
};

module.exports = {
  uploadToS3,
  uploadMultipleToS3,
  deleteFromS3,
  deleteMultipleFromS3,
  generatePresignedUrl,
  fileExists,
  getFileMetadata,
  listFiles,
  validateFile,
  generateFileName
};
