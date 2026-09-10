/* Supabase 접속 정보
 * MBTI 사이트의 assets/config.js 에 넣은 두 값을 그대로 옮겨 적으세요.
 * 같은 Supabase 프로젝트를 쓰기 때문에 관리자 계정·메일 발송 설정을 함께 씁니다.
 * anon 키는 공개용 키라 저장소에 올려도 됩니다. service_role 키는 절대 넣지 마세요.
 */
export const SUPABASE_URL = "https://vewmmndhipvazzmttzzr.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_BSnYjtOMPv6gdf7k0vnb_A_f5_Si7EP";

// 메일로 오는 인증번호 자릿수. MBTI 사이트와 같은 값입니다.
export const OTP_LENGTH = 8;
// 인증번호 입력 제한 시간(초)
export const OTP_WINDOW_SECONDS = 60;
// 관리자 화면에서 아무 조작이 없으면 자동 로그아웃(분)
export const IDLE_MINUTES = 20;
// 관리자 화면 한 쪽에 보이는 기록 수
export const PER_PAGE = 12;
