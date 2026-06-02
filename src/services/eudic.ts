/**
 * 欧路词典 & 每日英语听力 官方开放平台 API 服务 (预留)
 * 官方文档: https://open.eudic.net/
 */

// 欧路生词本分类定义
export interface EudicCategory {
  id: string;
  name: string;
  count: number;
}

// 欧路查词返回的结构
export interface EudicSearchResponse {
  word: string;
  phonetic: string;
  translation: string;
}

/**
 * 欧路词典 API 管理类
 */
export class EudicService {
  private token: string = '';

  constructor(token?: string) {
    if (token) {
      this.token = token;
    }
  }

  /**
   * 设置用户的 Personal Developer Token
   * 用户可在 https://open.eudic.net/ 免费申请
   */
  public setToken(token: string) {
    this.token = token;
  }

  /**
   * 检查 Token 是否已配置
   */
  public isConfigured(): boolean {
    return !!this.token.trim();
  }

  /**
   * 通用请求头生成
   */
  private getHeaders() {
    return {
      'Authorization': this.token,
      'Content-Type': 'application/json'
    };
  }

  /**
   * 1. 获取用户在“每日英语听力/欧路词典”里的所有生词本分类
   */
  public async getCategories(): Promise<EudicCategory[]> {
    if (!this.isConfigured()) {
      throw new Error('未配置欧路词典 API Token');
    }

    try {
      const response = await fetch('https://api.eudic.net/v1/studylist/category', {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`获取分类失败: ${response.status}`);
      }

      const data = await response.json();
      // 欧路 API 返回的分类数组
      return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        count: item.word_count || 0
      }));
    } catch (error) {
      console.error('获取欧路生词本分类失败:', error);
      throw error;
    }
  }

  /**
   * 2. 将本客户端的学习句子或单词，同步上传到欧路词典生词本中
   * @param word 单词或句子
   * @param categoryId 生词本分类ID，若不传则存入默认生词本
   */
  public async addWordToStudyList(word: string, categoryId: string = '0'): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('未配置欧路词典 API Token');
    }

    try {
      const response = await fetch('https://api.eudic.net/v1/studylist/words', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          words: [word], // 支持批量添加，这里传入数组
          id: categoryId // 生词本分组ID
        })
      });

      if (!response.ok) {
        throw new Error(`同步单词失败: ${response.status}`);
      }

      const data = await response.json();
      return !!data;
    } catch (error) {
      console.error(`同步 [${word}] 到欧路词典失败:`, error);
      return false;
    }
  }

  /**
   * 3. 欧路词典权威查词接口
   * 获取欧路官方的高清释义与标准发音音标
   */
  public async searchWord(word: string): Promise<EudicSearchResponse | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const url = `https://api.eudic.net/v1/dictionary/search?word=${encodeURIComponent(word)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('查词失败');
      }

      const data = await response.json();
      if (data && data.word) {
        return {
          word: data.word,
          phonetic: data.phonetics || '',
          translation: data.translation || ''
        };
      }
      return null;
    } catch (error) {
      console.error(`欧路词典查词失败: ${word}`, error);
      return null;
    }
  }
}

// 导出单例服务
export const eudicService = new EudicService();
