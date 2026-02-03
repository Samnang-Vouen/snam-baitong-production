import { useLanguage } from './LanguageToggle';

export default function FeedbackCard({ 
  role, 
  farmer, 
  ministryFeedback, 
  feedbackSaving, 
  onFeedbackChange, 
  onFeedbackSave 
}) {
  const { t } = useLanguage();

  if (role === 'admin') {
    // Admin view - Display feedback
    return (
      <div className="card shadow-sm">
        <div className="card-header bg-warning text-dark">
          <h4 className="mb-0" style={{ fontSize: 'clamp(0.9rem, 3vw, 1.25rem)' }}>
            <i className="bi bi-chat-left-text me-2"></i>
            <span className="d-none d-sm-inline">{t('ministry_feedback') || 'Ministry Feedback'}</span>
            <span className="d-sm-none">{t('feedback') || 'Feedback'}</span>
          </h4>
        </div>
        <div className="card-body">
          {farmer?.ministryFeedback ? (
            <div className="alert alert-warning mb-0">
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap', fontSize: 'clamp(0.85rem, 2.5vw, 1rem)' }}>{farmer.ministryFeedback}</p>
            </div>
          ) : (
            <p className="text-muted mb-0" style={{ fontSize: 'clamp(0.85rem, 2.5vw, 1rem)' }}>
              <i className="bi bi-info-circle me-2"></i>
              {t('no_feedback_from_ministry_yet')}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (role === 'ministry') {
    // Ministry view - Edit feedback
    return (
      <div className="card shadow-sm">
        <div className="card-header bg-warning text-dark">
          <h4 className="mb-0" style={{ fontSize: 'clamp(0.9rem, 3vw, 1.25rem)' }}>
            <i className="bi bi-chat-left-text me-2"></i>
            <span className="d-none d-sm-inline">{t('ministry_feedback') || 'Ministry Feedback'}</span>
            <span className="d-sm-none">{t('feedback') || 'Feedback'}</span>
          </h4>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <textarea
              className="form-control"
              rows="4"
              maxLength="600"
              placeholder={t('feedback_placeholder') || 'Enter your feedback (optional, max 600 characters)...'}
              value={ministryFeedback}
              onChange={(e) => onFeedbackChange(e.target.value)}
              style={{ fontSize: 'clamp(0.85rem, 2.5vw, 1rem)' }}
            />
            <div className="text-muted small mt-1" style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>
              {ministryFeedback.length}/600 characters
            </div>
          </div>
          <button
            className="btn btn-primary"
            disabled={feedbackSaving}
            onClick={onFeedbackSave}
          >
            {feedbackSaving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                <span className="d-none d-sm-inline">{t('loading')}</span>
                <span className="d-sm-none">...</span>
              </>
            ) : (
              <>
                <i className="bi bi-send me-2"></i>
                <span className="d-none d-sm-inline">{t('submit_feedback') || 'Submit Feedback'}</span>
                <span className="d-sm-none">{t('submit') || 'Submit'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
