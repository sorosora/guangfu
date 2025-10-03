#!/usr/bin/env python3
"""
環境變數管理模組
統一處理環境變數載入、驗證和配置
符合 GitHub Actions 最佳實踐
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any


class EnvironmentConfig:
    """環境變數配置管理器"""
    
    # 定義所有必要的環境變數
    REQUIRED_ENV_VARS = {
        'redis': [
            'UPSTASH_REDIS_REST_URL',
            'UPSTASH_REDIS_REST_TOKEN'
        ],
        'r2': [
            'CLOUDFLARE_R2_ACCESS_KEY_ID',
            'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
            'CLOUDFLARE_R2_BUCKET_NAME'
        ],
        'optional': [
            'CLOUDFLARE_R2_ENDPOINTS',
            'TILE_GENERATION_AREAS'
        ]
    }
    
    # 預設值配置
    DEFAULT_VALUES = {
        'TILE_GENERATION_AREAS': 'guangfu',
        'CLOUDFLARE_R2_ENDPOINTS': None  # 將在 R2 設定中動態生成
    }
    
    def __init__(self, load_env_local: bool = True):
        """
        初始化環境變數配置
        
        Args:
            load_env_local: 是否載入 .env.local 檔案（僅本地開發用）
        """
        self.env_vars = {}
        self.is_production = os.getenv('GITHUB_ACTIONS') == 'true'
        
        if load_env_local and not self.is_production:
            self._load_env_local()
        
        self._load_environment_variables()
    
    def _load_env_local(self):
        """載入 .env.local 檔案（僅本地開發用）"""
        env_file = Path(__file__).parent.parent.parent / '.env.local'
        
        if env_file.exists():
            try:
                with open(env_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            value = value.strip('"\'')
                            os.environ[key] = value
                
                print(f"✅ 已載入本地環境變數檔案: {env_file}")
            except Exception as e:
                print(f"⚠️ 載入 .env.local 失敗: {e}")
        else:
            print("ℹ️ 未找到 .env.local 檔案，使用系統環境變數")
    
    def _load_environment_variables(self):
        """載入所有環境變數"""
        # 載入所有必要和可選的環境變數
        all_env_vars = (
            self.REQUIRED_ENV_VARS['redis'] + 
            self.REQUIRED_ENV_VARS['r2'] + 
            self.REQUIRED_ENV_VARS['optional']
        )
        
        for var_name in all_env_vars:
            default_value = self.DEFAULT_VALUES.get(var_name)
            value = os.getenv(var_name, default_value)
            self.env_vars[var_name] = value
    
    def validate_required_vars(self, categories: List[str] = None) -> bool:
        """
        驗證必要環境變數是否存在
        
        Args:
            categories: 要驗證的類別列表 ['redis', 'r2']，None 表示驗證全部
            
        Returns:
            bool: 所有必要變數都存在時回傳 True
        """
        if categories is None:
            categories = ['redis', 'r2']
        
        missing_vars = []
        
        for category in categories:
            if category in self.REQUIRED_ENV_VARS:
                for var_name in self.REQUIRED_ENV_VARS[category]:
                    value = self.env_vars.get(var_name)
                    if not value:
                        missing_vars.append(var_name)
        
        if missing_vars:
            self._print_missing_vars_error(missing_vars)
            return False
        
        return True
    
    def _print_missing_vars_error(self, missing_vars: List[str]):
        """列印缺失環境變數的錯誤訊息"""
        print("\n❌ 缺少必要的環境變數:")
        
        for var in missing_vars:
            print(f"   - {var}")
        
        print("\n🔧 解決方法:")
        if not self.is_production:
            print("   本地開發: 請在 .env.local 檔案中設定這些變數")
        else:
            print("   GitHub Actions: 請在 Repository Settings → Secrets 中設定這些變數")
        
        print("\n📚 更多資訊請參考 CLAUDE.md 中的環境變數設定說明")
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        取得環境變數值
        
        Args:
            key: 環境變數名稱
            default: 預設值
            
        Returns:
            環境變數值或預設值
        """
        return self.env_vars.get(key, default)
    
    def get_redis_config(self) -> Dict[str, str]:
        """取得 Redis 配置"""
        return {
            'url': self.get('UPSTASH_REDIS_REST_URL'),
            'token': self.get('UPSTASH_REDIS_REST_TOKEN')
        }
    
    def get_r2_config(self) -> Dict[str, str]:
        """取得 Cloudflare R2 配置"""
        return {
            'access_key_id': self.get('CLOUDFLARE_R2_ACCESS_KEY_ID'),
            'secret_access_key': self.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
            'bucket_name': self.get('CLOUDFLARE_R2_BUCKET_NAME'),
            'endpoints': self.get('CLOUDFLARE_R2_ENDPOINTS')
        }
    
    def get_tile_generation_areas(self) -> List[str]:
        """取得圖磚生成區域列表"""
        areas_str = self.get('TILE_GENERATION_AREAS', 'guangfu')
        return [area.strip() for area in areas_str.split(',')]
    
    def print_config_summary(self):
        """列印配置摘要（不包含敏感資料）"""
        print("\n📋 環境配置摘要:")
        print(f"   執行環境: {'GitHub Actions' if self.is_production else '本地開發'}")
        print(f"   圖磚生成區域: {self.get_tile_generation_areas()}")
        
        # 檢查 Redis 配置
        redis_config = self.get_redis_config()
        redis_ok = bool(redis_config['url'] and redis_config['token'])
        print(f"   Redis 配置: {'✅ 已設定' if redis_ok else '❌ 未設定'}")
        
        # 檢查 R2 配置
        r2_config = self.get_r2_config()
        r2_ok = bool(r2_config['access_key_id'] and r2_config['secret_access_key'] and r2_config['bucket_name'])
        print(f"   R2 配置: {'✅ 已設定' if r2_ok else '❌ 未設定'}")
        
        if r2_config['endpoints']:
            print(f"   R2 端點: {r2_config['endpoints']}")


def create_env_config(validate_redis: bool = True, validate_r2: bool = True) -> EnvironmentConfig:
    """
    建立並驗證環境變數配置
    
    Args:
        validate_redis: 是否驗證 Redis 環境變數
        validate_r2: 是否驗證 R2 環境變數
        
    Returns:
        EnvironmentConfig: 已驗證的環境配置實例
        
    Raises:
        SystemExit: 當必要環境變數缺失時
    """
    env_config = EnvironmentConfig()
    
    # 驗證環境變數
    categories_to_validate = []
    if validate_redis:
        categories_to_validate.append('redis')
    if validate_r2:
        categories_to_validate.append('r2')
    
    if categories_to_validate and not env_config.validate_required_vars(categories_to_validate):
        print("\n❌ 環境變數驗證失敗，無法繼續執行")
        sys.exit(1)
    
    env_config.print_config_summary()
    return env_config


# 便利函數，用於快速取得常用配置
def get_redis_config() -> Dict[str, str]:
    """快速取得 Redis 配置"""
    env_config = create_env_config(validate_redis=True, validate_r2=False)
    return env_config.get_redis_config()


def get_r2_config() -> Dict[str, str]:
    """快速取得 R2 配置"""
    env_config = create_env_config(validate_redis=False, validate_r2=True)
    return env_config.get_r2_config()


def get_full_config() -> EnvironmentConfig:
    """取得完整配置（驗證所有必要環境變數）"""
    return create_env_config(validate_redis=True, validate_r2=True)


if __name__ == "__main__":
    """測試環境變數配置"""
    print("🧪 測試環境變數配置模組")
    
    try:
        config = get_full_config()
        print("\n✅ 環境變數配置測試成功")
        
        # 列印一些非敏感的配置資訊
        print(f"\n📊 配置詳情:")
        print(f"   圖磚生成區域: {config.get_tile_generation_areas()}")
        
    except SystemExit:
        print("\n❌ 環境變數配置測試失敗")