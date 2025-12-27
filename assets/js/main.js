// Gemini API 설정 및 블로그 글 생성 로직

// DOM 요소 변수 (나중에 초기화)
let keywordInput, generateBtn, loadingDiv, resultSection, blogContent, copyBtn, errorMessage, charCount;

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 초기화
    keywordInput = document.getElementById('keywordInput');
    generateBtn = document.getElementById('generateBtn');
    loadingDiv = document.querySelector('.loading');
    resultSection = document.querySelector('.result-section');
    blogContent = document.getElementById('blogContent');
    copyBtn = document.getElementById('copyBtn');
    errorMessage = document.querySelector('.error-message');
    charCount = document.querySelector('.char-count');
    
    // DOM 요소 존재 확인
    if (!keywordInput || !generateBtn || !loadingDiv || 
        !resultSection || !blogContent || !copyBtn || !errorMessage || !charCount) {
        console.error('필수 DOM 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 이벤트 리스너 등록
    initEventListeners();
});

// 이벤트 리스너 초기화
function initEventListeners() {
    // 글 생성 버튼 클릭 이벤트
    generateBtn.addEventListener('click', handleGenerateClick);
    
    // Enter 키로도 생성 가능
    keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !generateBtn.disabled) {
            generateBtn.click();
        }
    });
    
    // 복사 버튼 이벤트
    copyBtn.addEventListener('click', handleCopyClick);
}

// 글 생성 핸들러
async function handleGenerateClick() {
    const keyword = keywordInput.value.trim();
    
    // 입력 검증
    if (!keyword) {
        showError('키워드를 입력해주세요!');
        keywordInput.focus();
        return;
    }
    
    // 키워드 길이 제한 (보안 및 성능)
    if (keyword.length > 200) {
        showError('키워드는 200자 이하여야 합니다.');
        keywordInput.focus();
        return;
    }
    
    // UI 상태 변경
    setLoading(true);
    hideError();
    hideResult();
    
    try {
        // Netlify Function 사용 (환경 변수에서 API 키 가져옴)
        const blogPost = await generateBlogPostViaFunction(keyword);
        
        if (!blogPost || blogPost.trim().length === 0) {
            throw new Error('생성된 글이 비어있습니다.');
        }
        showResult(blogPost);
    } catch (error) {
        let errorMsg = '블로그 글 생성 중 오류가 발생했습니다.';
        
        if (error.message.includes('CORS') || error.message.includes('network')) {
            errorMsg = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
        } else if (error.message.includes('API_KEY') || error.message.includes('환경 변수')) {
            errorMsg = 'API 키가 설정되지 않았습니다. Netlify 환경 변수 GEMINI_API_KEY를 확인해주세요.';
        } else if (error.message) {
            errorMsg = error.message;
        }
        
        showError(errorMsg);
        console.error('Error:', error);
    } finally {
        setLoading(false);
    }
}

// Netlify Function을 통한 블로그 글 생성 (환경 변수 사용)
async function generateBlogPostViaFunction(keyword) {
    // 로컬 개발 환경 확인
    const isFileProtocol = window.location.protocol === 'file:';
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname === '';
    
    // Netlify 배포 환경 확인
    const isNetlify = window.location.hostname.includes('netlify.app') || 
                      window.location.hostname.includes('netlify.com');
    
    // 파일 프로토콜로 열었거나 로컬호스트인데 Netlify가 아닌 경우
    if ((isFileProtocol || isLocalhost) && !isNetlify) {
        // Netlify Dev로 실행 중인지 확인 (포트 8888 또는 8889)
        const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
        const isNetlifyDev = currentPort === '8888' || currentPort === '8889';
        
        if (!isNetlifyDev) {
            throw new Error('로컬 개발 환경에서는 Netlify Dev를 사용해야 합니다.\n\n해결 방법:\n1. 터미널에서 프로젝트 폴더로 이동\n2. netlify dev 명령어 실행\n3. 브라우저에서 http://localhost:8888 접속\n\n또는 Netlify에 배포하여 사용하세요.');
        }
    }
    
    try {
        const response = await fetch('/.netlify/functions/generate-blog', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ keyword })
        });
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (parseError) {
                // JSON 파싱 실패 시 기본 에러 메시지
                throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
            }
            
            // 404 오류인 경우 특별 처리
            if (response.status === 404) {
                throw new Error('Netlify Function을 찾을 수 없습니다.\n\n확인 사항:\n1. netlify/functions/generate-blog.js 파일이 존재하는지 확인\n2. Netlify에 재배포했는지 확인\n3. Netlify 대시보드에서 Functions 탭 확인');
            }
            
            // 504 타임아웃 오류인 경우 특별 처리
            if (response.status === 504) {
                throw new Error('서버 응답 시간이 초과되었습니다.\n\n가능한 원인:\n1. Gemini API 응답이 너무 느림\n2. 네트워크 연결 문제\n3. 서버 부하\n\n해결 방법:\n잠시 후 다시 시도해주세요.');
            }
            
            // 500번대 서버 오류
            if (response.status >= 500) {
                throw new Error(errorData.error || `서버 오류가 발생했습니다. (${response.status})\n잠시 후 다시 시도해주세요.`);
            }
            
            throw new Error(errorData.error || `서버 오류: ${response.status}`);
        }
        
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            throw new Error('서버 응답을 파싱할 수 없습니다.');
        }
        
        // 응답 데이터 검증
        if (!data || typeof data !== 'object' || !data.content) {
            throw new Error('서버 응답 형식이 올바르지 않습니다.');
        }
        
        return data.content;
    } catch (error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
            // 404는 이미 위에서 처리했으므로 다른 네트워크 오류
            if (error.message.includes('404')) {
                throw error; // 위에서 처리한 404 오류는 그대로 전달
            }
            throw new Error('네트워크 연결 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
        }
        throw error;
    }
}


// UI 업데이트 함수들
function setLoading(isLoading) {
    if (!generateBtn || !loadingDiv) return;
    
    generateBtn.disabled = isLoading;
    loadingDiv.classList.toggle('active', isLoading);
    
    // 로딩 중에는 키워드 입력 필드도 비활성화
    if (keywordInput) {
        keywordInput.disabled = isLoading;
    }
}

function showResult(content) {
    if (!blogContent || !resultSection || !charCount) return;
    
    if (!content || content.trim().length === 0) {
        showError('표시할 내용이 없습니다.');
        return;
    }
    
    blogContent.textContent = content;
    resultSection.classList.add('active');
    
    // 글자 수 표시 (공백 제외)
    const textWithoutSpaces = content.replace(/\s/g, '');
    charCount.textContent = `글자 수: ${textWithoutSpaces.length.toLocaleString()}자 (공백 제외)`;
    
    // 결과로 스크롤 (약간의 지연 후)
    setTimeout(() => {
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function hideResult() {
    if (!resultSection) return;
    resultSection.classList.remove('active');
}

function showError(message) {
    if (!errorMessage) {
        console.error('Error:', message);
        return;
    }
    
    // 에러 메시지에 개행 문자를 <br>로 변환하여 표시
    const formattedMessage = (message || '오류가 발생했습니다.').replace(/\n/g, '<br>');
    errorMessage.innerHTML = formattedMessage;
    errorMessage.classList.add('active');
    
    // 에러 메시지로 스크롤
    setTimeout(() => {
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
}

function hideError() {
    if (!errorMessage) return;
    errorMessage.classList.remove('active');
}

// 복사 버튼 기능
async function handleCopyClick() {
    const text = blogContent.textContent;
    
    if (!text || text.trim().length === 0) {
        showError('복사할 내용이 없습니다.');
        return;
    }
    
    try {
        // 최신 클립보드 API 사용
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            // 구형 브라우저를 위한 대체 방법
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
            } catch (execError) {
                throw new Error('복사 기능을 사용할 수 없습니다.');
            }
            
            document.body.removeChild(textArea);
        }
        
        // 성공 피드백
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '복사 완료!';
        copyBtn.classList.add('copied');
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        console.error('복사 오류:', err);
        showError('복사에 실패했습니다. 수동으로 선택하여 복사해주세요.');
    }
}

