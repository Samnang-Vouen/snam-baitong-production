import { useState } from 'react';
import QRCode from 'qrcode';
import { farmerService } from '../services/farmerService';

export function useQRCode(id, farmer) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [generatingQR, setGeneratingQR] = useState(false);
  const [error, setError] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleGenerateQR = async () => {
    try {
      setGeneratingQR(true);
      setError('');
      
      const qrUrl = await farmerService.generateQR(id);
      console.log('Generated QR URL:', qrUrl); // Debug log
      
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('QR Generation Error:', err);
      const errorMsg = err?.response?.data?.error || 'Failed to generate QR';
      setError(errorMsg);
      // Auto-dismiss error after 3 seconds
      setTimeout(() => setError(''), 3000);
    } finally {
      setGeneratingQR(false);
    }
  };

  const handleDownloadQR = async () => {
    if (!farmer || !qrDataUrl) return;

    try {
      const fileName = `${farmer.firstName}_${farmer.lastName}_QR.png`;
      
      // Check if mobile device (screen width <= 768px) and Share API is available
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile && navigator.share && navigator.canShare) {
        // Mobile-first approach: Use native Share API
        try {
          // Convert data URL to blob using fetch
          const response = await fetch(qrDataUrl);
          const blob = await response.blob();
          const file = new File([blob], fileName, { type: 'image/png' });
          
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'QR Code',
              text: `QR Code for ${farmer.firstName} ${farmer.lastName}`
            });
            
            setDownloadSuccess(true);
            setTimeout(() => setDownloadSuccess(false), 3000);
            return;
          }
        } catch (shareErr) {
          console.log('Share API failed, falling back to download:', shareErr);
          // Fall through to regular download
        }
      }
      
      // Desktop or fallback: Regular download
      // Convert data URL to blob using fetch (simplified approach)
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Clean up with improved timing
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
      
    } catch (err) {
      console.error('Download failed:', err);
      const errorMsg = 'Download failed. Please try again or take a screenshot.';
      setError(errorMsg);
      // Auto-dismiss error after 3 seconds
      setTimeout(() => setError(''), 3000);
    }
  };

  return {
    qrDataUrl,
    generatingQR,
    error,
    downloadSuccess,
    handleGenerateQR,
    handleDownloadQR
  };
}
